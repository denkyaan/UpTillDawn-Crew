"use client"

import {useEffect,useMemo,useState} from "react"
import {Download,Share2,X} from "lucide-react"
import {createClient} from "@/lib/supabase/crew-client"
import {useAuth} from "@/lib/providers"
import {isInstalledPwa} from "@/lib/push-client"
import {
  LANGUAGE_APPLIED_EVENT,
  parseUiLocale,
  type SupportedUiLocale,
} from "@/lib/locale-preferences"
import {
  PWA_INSTALL_PROMPT_EVENT,
  PWA_INSTALL_PROMPT_PENDING_KEY,
  clearQueuedPwaInstallPrompt,
} from "@/lib/pwa-install-prompt"

type InstallPromptEvent=Event&{
  prompt:()=>Promise<void>
  userChoice:Promise<{outcome:"accepted"|"dismissed";platform:string}>
}

const DISMISS_MS=7*24*60*60*1000

const COPY={
  nl:{
    heading:"Up Till Dawn toevoegen aan uw toestel",
    intro:"Na registratie kunt u Up Till Dawn als app op uw toestel zetten voor snelle toegang, achtergrondupdates en meldingen.",
    decline:"Installatie overslaan",
    iosHeading:"iPhone / iPad",
    iosInstruction:"Open deze pagina in Safari. Tik op Deel en kies daarna ‘Zet op beginscherm’. Open vervolgens Up Till Dawn via het nieuwe app-icoon.",
    iosNotice:"Op iPhone en iPad vereist Apple één handmatige bevestiging via het Safari-deelmenu.",
    accepted:"Installatie bevestigd. Open Up Till Dawn via het nieuwe app-icoon zodra uw browser klaar is.",
    fallback:"Open het browsermenu en kies ‘App installeren’ of ‘Toevoegen aan startscherm’.",
    confirm:"TOEVOEGEN ALS APP",
    working:"INSTALLATIE STARTEN…",
    done:"BEGREPEN",
  },
  en:{
    heading:"Add Up Till Dawn to your device",
    intro:"After registration, you can add Up Till Dawn as an app for quick access, background updates and notifications.",
    decline:"Skip installation",
    iosHeading:"iPhone / iPad",
    iosInstruction:"Open this page in Safari. Tap Share, then choose ‘Add to Home Screen’. Then open Up Till Dawn from the new app icon.",
    iosNotice:"On iPhone and iPad, Apple requires one manual confirmation through Safari’s Share menu.",
    accepted:"Installation confirmed. Open Up Till Dawn from the new app icon when your browser has finished.",
    fallback:"Open the browser menu and choose ‘Install app’ or ‘Add to Home Screen’.",
    confirm:"ADD AS APP",
    working:"STARTING INSTALLATION…",
    done:"GOT IT",
  },
  fr:{
    heading:"Ajouter Up Till Dawn à votre appareil",
    intro:"Après l’inscription, vous pouvez ajouter Up Till Dawn comme application pour un accès rapide, les mises à jour en arrière-plan et les notifications.",
    decline:"Ignorer l’installation",
    iosHeading:"iPhone / iPad",
    iosInstruction:"Ouvrez cette page dans Safari. Touchez Partager puis choisissez « Sur l’écran d’accueil ». Ouvrez ensuite Up Till Dawn via la nouvelle icône.",
    iosNotice:"Sur iPhone et iPad, Apple exige une confirmation manuelle via le menu Partager de Safari.",
    accepted:"Installation confirmée. Ouvrez Up Till Dawn via la nouvelle icône lorsque votre navigateur a terminé.",
    fallback:"Ouvrez le menu du navigateur et choisissez « Installer l’app » ou « Ajouter à l’écran d’accueil ».",
    confirm:"AJOUTER COMME APP",
    working:"DÉMARRAGE DE L’INSTALLATION…",
    done:"COMPRIS",
  },
  de:{
    heading:"Up Till Dawn zum Gerät hinzufügen",
    intro:"Nach der Registrierung können Sie Up Till Dawn für schnellen Zugriff, Hintergrundupdates und Benachrichtigungen als App hinzufügen.",
    decline:"Installation überspringen",
    iosHeading:"iPhone / iPad",
    iosInstruction:"Öffnen Sie diese Seite in Safari. Tippen Sie auf Teilen und wählen Sie danach „Zum Home-Bildschirm“. Öffnen Sie Up Till Dawn anschließend über das neue App-Symbol.",
    iosNotice:"Auf iPhone und iPad verlangt Apple eine manuelle Bestätigung über das Teilen-Menü von Safari.",
    accepted:"Installation bestätigt. Öffnen Sie Up Till Dawn über das neue App-Symbol, sobald der Browser fertig ist.",
    fallback:"Öffnen Sie das Browsermenü und wählen Sie „App installieren“ oder „Zum Startbildschirm hinzufügen“.",
    confirm:"ALS APP HINZUFÜGEN",
    working:"INSTALLATION WIRD GESTARTET…",
    done:"VERSTANDEN",
  },
} as const

function isIos(){
  if(typeof navigator==="undefined")return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export function FirstUseInstallPrompt(){
  const {user,loading}=useAuth()
  const db=useMemo(()=>createClient(),[])
  const [deferred,setDeferred]=useState<InstallPromptEvent|null>(null)
  const [visible,setVisible]=useState(false)
  const [iosHelp,setIosHelp]=useState(false)
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState("")
  // Deterministic SSR/client first render; device locale is applied after mount.
  const [locale,setLocale]=useState<SupportedUiLocale>("nl")
  const t=(key:keyof typeof COPY.nl)=>COPY[locale][key]

  useEffect(()=>{
    const onLanguage=(event:Event)=>{
      const next=parseUiLocale((event as CustomEvent<string>).detail)
      if(next)setLocale(next)
    }
    window.addEventListener(LANGUAGE_APPLIED_EVENT,onLanguage)
    return()=>window.removeEventListener(LANGUAGE_APPLIED_EVENT,onLanguage)
  },[])

  useEffect(()=>{
    const handler=(event:Event)=>{
      event.preventDefault()
      setDeferred(event as InstallPromptEvent)
    }
    window.addEventListener("beforeinstallprompt",handler)
    return()=>window.removeEventListener("beforeinstallprompt",handler)
  },[])

  useEffect(()=>{
    const evaluate=()=>{
      if(isInstalledPwa()){
        setVisible(false)
        clearQueuedPwaInstallPrompt()
        return
      }
      const localPending=localStorage.getItem(PWA_INSTALL_PROMPT_PENDING_KEY)==="1"
      const accountPending=!loading&&user?.user_metadata?.pwa_install_prompt_pending===true
      const dismissed=Number(localStorage.getItem("upt-pwa-install-dismissed")||0)
      const allowed=!dismissed||Date.now()-dismissed>DISMISS_MS
      setVisible(Boolean((localPending||accountPending)&&allowed))
    }
    const timer=window.setTimeout(evaluate,0)
    window.addEventListener(PWA_INSTALL_PROMPT_EVENT,evaluate)
    return()=>{
      window.clearTimeout(timer)
      window.removeEventListener(PWA_INSTALL_PROMPT_EVENT,evaluate)
    }
  },[loading,user])

  useEffect(()=>{
    const installed=()=>{
      setVisible(false)
      setMessage("")
      clearQueuedPwaInstallPrompt()
      localStorage.removeItem("upt-pwa-install-dismissed")
      if(user)void db.auth.updateUser({data:{pwa_install_prompt_pending:false}})
    }
    window.addEventListener("appinstalled",installed)
    return()=>window.removeEventListener("appinstalled",installed)
  },[db,user])

  if(!visible)return null

  async function finish(){
    clearQueuedPwaInstallPrompt()
    localStorage.removeItem("upt-pwa-install-dismissed")
    if(user)await db.auth.updateUser({data:{pwa_install_prompt_pending:false}})
    setVisible(false)
  }

  async function confirm(){
    setBusy(true)
    setMessage("")
    try{
      if(isInstalledPwa()){
        await finish()
        return
      }
      if(deferred){
        await deferred.prompt()
        const choice=await deferred.userChoice
        setDeferred(null)
        if(choice.outcome==="accepted"){
          setMessage(t("accepted"))
          window.setTimeout(()=>void finish(),1200)
        }else{
          localStorage.setItem("upt-pwa-install-dismissed",String(Date.now()))
          clearQueuedPwaInstallPrompt()
          setVisible(false)
        }
        return
      }
      if(isIos()){
        setIosHelp(true)
        setMessage(t("iosNotice"))
        return
      }
      setMessage(t("fallback"))
    }finally{
      setBusy(false)
    }
  }

  function dismiss(){
    localStorage.setItem("upt-pwa-install-dismissed",String(Date.now()))
    clearQueuedPwaInstallPrompt()
    setVisible(false)
    if(user)void db.auth.updateUser({data:{pwa_install_prompt_pending:false}})
  }

  return <aside data-no-translate className="fixed inset-0 z-[150] grid place-items-center bg-black/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="pwa-install-title">
    <section className="relative w-full max-w-md rounded-3xl border border-white/15 bg-zinc-950 p-6 text-white shadow-2xl">
      <button type="button" aria-label={t("decline")} onClick={dismiss} className="absolute right-3 top-3 rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white">
        <X className="h-4 w-4"/>
      </button>
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-violet-600/20 text-violet-300">
        <Download className="h-6 w-6"/>
      </div>
      <h2 id="pwa-install-title" className="pr-8 text-xl font-black">{t("heading")}</h2>
      <p className="mt-3 text-sm leading-6 text-zinc-300">{t("intro")}</p>

      {iosHelp&&<div className="mt-4 rounded-2xl border border-white/10 bg-black p-4 text-sm">
        <p className="font-bold">{t("iosHeading")}</p>
        <p className="mt-2 flex items-start gap-2 text-zinc-300"><Share2 className="mt-0.5 h-4 w-4 shrink-0"/><span>{t("iosInstruction")}</span></p>
      </div>}

      {message&&<p role="status" className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-zinc-300">{message}</p>}

      <button
        type="button"
        disabled={busy}
        onClick={iosHelp?dismiss:()=>void confirm()}
        className="mt-5 w-full rounded-xl bg-white p-3 font-black text-black disabled:opacity-60"
      >
        {busy?t("working"):iosHelp?t("done"):t("confirm")}
      </button>
    </section>
  </aside>
}
