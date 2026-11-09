"use client"

import {useCallback,useEffect,useRef,useState} from "react"
import {Camera,CameraOff,ExternalLink,ScanLine} from "lucide-react"
import {activeUiLocale,LANGUAGE_APPLIED_EVENT,type SupportedUiLocale} from "@/lib/locale-preferences"
import {WEEZTIX_SCANNER_LINKS,validWeeztixBarcode} from "@/lib/weeztix-scanner"

type QRReader=(data:Uint8ClampedArray,width:number,height:number,options?:{inversionAttempts?:string})=>{data:string}|null
type QRWindow=Window&{jsQR?:QRReader}
const copy={
 nl:{title:"Tickets scannen",detail:"Scan Weeztix-tickets rechtstreeks in UpTillDawn. Alleen een bevestiging van Weeztix geeft toegang.",camera:"Camera starten",stop:"Camera stoppen",manual:"Barcode handmatig invoeren",submit:"Controleer ticket",waiting:"Ticket online verifiëren…",ready:"Richt de camera op de QR-code.",success:"TICKET GOEDGEKEURD · TOEGANG",rejected:"TICKET GEWEIGERD · Niet opnieuw toelaten zonder controle.",notFound:"Ticket niet gevonden in Weeztix.",forbidden:"Geen toestemming om hier tickets te scannen.",noConfig:"In-app scanning moet nog gekoppeld worden aan het Weeztix-event.",offline:"Geen verbinding of antwoord van Weeztix. Geen toegang verlenen.",cameraError:"Camera niet beschikbaar. Voer de ticketcode handmatig in.",cameraLoading:"Camera voorbereiden…",invalid:"Voer een geldige Weeztix-ticketcode in.",busy:"Een ticket wordt al verwerkt.",fallback:"Officiële scanner als noodoplossing",setup:"Weeztix beheren",info:"Online validatie vereist. De officiële Weeztix-app kan offline scannen na vooraf synchroniseren; deze in-app scanner niet.",permission:"Alleen toegewezen inkomcrew en verantwoordelijken kunnen scannen.",unavailable:"Geen QR-code gevonden. Zorg voor voldoende licht en houd het ticket stil."},
 fr:{title:"Scanner des billets",detail:"Scannez les billets Weeztix dans UpTillDawn. Seule une confirmation Weeztix autorise l’entrée.",camera:"Démarrer la caméra",stop:"Arrêter la caméra",manual:"Saisir le code manuellement",submit:"Vérifier le billet",waiting:"Vérification en ligne…",ready:"Placez le QR code devant la caméra.",success:"BILLET ACCEPTÉ · ENTRÉE",rejected:"BILLET REFUSÉ · Vérification nécessaire.",notFound:"Billet introuvable chez Weeztix.",forbidden:"Accès au scanner refusé.",noConfig:"La connexion au Weeztix de cet événement doit être configurée.",offline:"Weeztix inaccessible. Ne pas autoriser l’entrée.",cameraError:"Caméra indisponible. Saisissez le code manuellement.",cameraLoading:"Préparation de la caméra…",invalid:"Code billet Weeztix invalide.",busy:"Billet en cours de traitement.",fallback:"Scanner officiel de secours",setup:"Gérer Weeztix",info:"Validation en ligne obligatoire. L’application officielle peut scanner hors ligne après synchronisation.",permission:"Réservé au personnel d’entrée autorisé.",unavailable:"QR non détecté. Éclairez le billet et stabilisez-le."},
 en:{title:"Scan tickets",detail:"Scan Weeztix tickets directly in UpTillDawn. Entry requires a confirmed Weeztix response.",camera:"Start camera",stop:"Stop camera",manual:"Enter ticket barcode",submit:"Verify ticket",waiting:"Verifying with Weeztix…",ready:"Point the camera at the QR code.",success:"TICKET ACCEPTED · ADMIT",rejected:"TICKET REJECTED · Do not admit without review.",notFound:"Ticket not found at Weeztix.",forbidden:"No permission to scan tickets here.",noConfig:"Connect this event to Weeztix before in-app scanning.",offline:"Weeztix could not verify this ticket. Do not admit.",cameraError:"Camera unavailable. Enter the code manually.",cameraLoading:"Preparing camera…",invalid:"Enter a valid Weeztix barcode.",busy:"A ticket is already being processed.",fallback:"Official backup scanner",setup:"Manage Weeztix",info:"Online validation is required. The official Weeztix app can scan offline after syncing.",permission:"Only assigned entrance crew and responsible leads may scan.",unavailable:"No QR detected. Improve lighting and hold the ticket still."},
 de:{title:"Tickets scannen",detail:"Weeztix-Tickets direkt in UpTillDawn scannen. Einlass nur nach Bestätigung von Weeztix.",camera:"Kamera starten",stop:"Kamera stoppen",manual:"Ticketcode eingeben",submit:"Ticket prüfen",waiting:"Onlineprüfung läuft…",ready:"QR-Code vor die Kamera halten.",success:"TICKET GÜLTIG · EINLASS",rejected:"TICKET ABGELEHNT · Nicht ohne Prüfung einlassen.",notFound:"Ticket bei Weeztix nicht gefunden.",forbidden:"Keine Berechtigung für den Ticketscanner.",noConfig:"Weeztix muss für dieses Event verbunden werden.",offline:"Weeztix nicht erreichbar. Kein Einlass.",cameraError:"Kamera nicht verfügbar. Code manuell eingeben.",cameraLoading:"Kamera wird vorbereitet…",invalid:"Ungültiger Weeztix-Ticketcode.",busy:"Ticket wird bereits geprüft.",fallback:"Offizieller Ersatzscanner",setup:"Weeztix verwalten",info:"Onlineprüfung ist erforderlich. Die offizielle App kann nach Synchronisierung offline scannen.",permission:"Nur zugewiesenes Einlasspersonal darf scannen.",unavailable:"QR nicht erkannt. Licht verbessern und Ticket still halten."}
} as const

function loadQrDecoder():Promise<QRReader>{
 const existing=(window as QRWindow).jsQR
 if(existing)return Promise.resolve(existing)
 return new Promise((resolve,reject)=>{
  const script=document.createElement("script")
  script.src="/vendor/jsqr-1.4.0.js"
  script.async=true
  script.onload=()=>{const qr=(window as QRWindow).jsQR;if(qr)resolve(qr);else reject(new Error("qr_decoder_missing"))}
  script.onerror=()=>reject(new Error("qr_decoder_load_failed"))
  document.head.append(script)
 })
}

export function WeeztixScannerPanel({eventName,eventId,workplaceId,canManage=false,initialLocale="nl"}:{eventName:string;eventId:string;workplaceId:string;canManage?:boolean;initialLocale?:SupportedUiLocale}){
 const [locale,setLocale]=useState<SupportedUiLocale>(initialLocale)
 const [cameraActive,setCameraActive]=useState(false)
 const [cameraLoading,setCameraLoading]=useState(false)
 const [barcode,setBarcode]=useState("")
 const [sending,setSending]=useState(false)
 const [result,setResult]=useState<{ok:boolean;code:string}|null>(null)
 const [cameraProblem,setCameraProblem]=useState(false)
 const video=useRef<HTMLVideoElement>(null)
 const canvas=useRef<HTMLCanvasElement>(null)
 const media=useRef<MediaStream|null>(null)
 const frame=useRef<number|null>(null)
 const lastDecode=useRef(0)
 const lastAttempt=useRef<{barcode:string;at:number}>({barcode:"",at:0})
 const busy=useRef(false)
 const decoder=useRef<QRReader|null>(null)
 const mounted=useRef(true)
 useEffect(()=>{const apply=()=>setLocale(activeUiLocale());apply();window.addEventListener(LANGUAGE_APPLIED_EVENT,apply);return()=>window.removeEventListener(LANGUAGE_APPLIED_EVENT,apply)},[])
 const stop=useCallback(()=>{
  if(frame.current!==null){cancelAnimationFrame(frame.current);frame.current=null}
  media.current?.getTracks().forEach(track=>track.stop());media.current=null
  if(video.current)video.current.srcObject=null
  setCameraActive(false)
 },[])
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;if(frame.current!==null)cancelAnimationFrame(frame.current);media.current?.getTracks().forEach(track=>track.stop())}},[])
 const send=useCallback(async(value:string)=>{
  const code=value.trim()
  if(busy.current)return
  if(!validWeeztixBarcode(code)){setResult({ok:false,code:"invalid_request"});return}
  if(lastAttempt.current.barcode===code&&Date.now()-lastAttempt.current.at<3500)return
  lastAttempt.current={barcode:code,at:Date.now()}
  busy.current=true;setSending(true);setResult(null)
  try{
   const res=await fetch("/api/weeztix/scan",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({eventId,workplaceId,barcode:code}),cache:"no-store"})
   const payload:unknown=await res.json().catch(()=>null)
   const data=payload&&typeof payload==="object"&&"code" in payload?payload as {code?:string;ok?:boolean}:null
   if(!mounted.current)return
   setResult({ok:res.ok&&data?.code==="admitted"&&data?.ok===true,code:data?.code||"provider_unavailable"})
   setBarcode("")
  }catch{if(mounted.current)setResult({ok:false,code:"provider_unavailable"})}
  finally{busy.current=false;if(mounted.current)setSending(false)}
 },[eventId,workplaceId])
 const tick=useCallback(()=>{
  if(!mounted.current||!media.current)return
  frame.current=requestAnimationFrame(tick)
  const now=performance.now()
  if(now-lastDecode.current<160||busy.current)return
  lastDecode.current=now
  const v=video.current,c=canvas.current,qr=decoder.current
  if(!v||!c||!qr||v.readyState<2||!v.videoWidth)return
  const width=Math.min(v.videoWidth,720),height=Math.max(1,Math.round(width*v.videoHeight/v.videoWidth))
  c.width=width;c.height=height
  const ctx=c.getContext("2d",{willReadFrequently:true})
  if(!ctx)return
  ctx.drawImage(v,0,0,width,height)
  const pixels=ctx.getImageData(0,0,width,height)
  const detected=qr(pixels.data,width,height,{inversionAttempts:"attemptBoth"})
  if(detected?.data)void send(detected.data)
 },[send])
 async function start(){
  if(cameraLoading||cameraActive)return
  setCameraLoading(true);setCameraProblem(false);setResult(null)
  try{
   decoder.current=await loadQrDecoder()
   if(!mounted.current)return
   const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1280}},audio:false})
   if(!mounted.current){stream.getTracks().forEach(track=>track.stop());return}
   media.current=stream
   if(!video.current)throw new Error("video_missing")
   video.current.srcObject=stream
   await video.current.play()
   if(!mounted.current)return
   setCameraActive(true)
   tick()
  }catch{stop();if(mounted.current)setCameraProblem(true)}
  finally{if(mounted.current)setCameraLoading(false)}
 }
 const t=copy[locale]
 const errorText=result?.code==="invalid_request"?t.invalid:result?.code==="not_configured"?t.noConfig:result?.code==="forbidden"||result?.code==="unauthorized"?t.forbidden:result?.code==="ticket_not_found"?t.notFound:result?.code==="provider_rejected"?t.rejected:t.offline
 return <section data-weeztix-scanner className="mt-3 space-y-3 rounded-xl border p-4" aria-label={t.title}>
  <div className="flex items-start gap-2"><ScanLine className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true"/><div><h2 className="font-semibold">{t.title}</h2><p className="text-sm text-muted-foreground">{eventName}</p></div></div>
  <p className="text-sm">{t.detail}</p>
  <div className="flex flex-wrap gap-2">
   {!cameraActive?<button type="button" onClick={()=>void start()} disabled={cameraLoading||sending} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-violet-700 px-4 py-2 font-semibold text-white disabled:opacity-50"><Camera size={18}/>{cameraLoading?t.cameraLoading:t.camera}</button>:<button type="button" onClick={stop} className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 py-2 font-semibold"><CameraOff size={18}/>{t.stop}</button>}
   {canManage&&<a href={WEEZTIX_SCANNER_LINKS.dashboard} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-sm">{t.setup}<ExternalLink size={15}/></a>}
  </div>
  <div className={cameraActive?"overflow-hidden rounded-xl bg-black":"hidden"}><video ref={video} className="w-full max-h-80 object-contain" playsInline muted autoPlay aria-label={t.ready}/></div>
  <canvas ref={canvas} className="hidden" aria-hidden="true"/>
  {cameraActive&&<p className="text-sm text-muted-foreground">{t.ready}</p>}
  {cameraProblem&&<p role="alert" className="text-sm text-amber-500">{t.cameraError}</p>}
  <form className="flex flex-wrap items-end gap-2" onSubmit={e=>{e.preventDefault();void send(barcode)}}>
   <label className="min-w-0 flex-1 text-sm">{t.manual}<input className="mt-1 w-full min-h-11 rounded-lg border bg-background px-3" inputMode="text" autoComplete="off" maxLength={160} value={barcode} onChange={e=>setBarcode(e.target.value)}/></label>
   <button type="submit" disabled={sending||!barcode.trim()} className="min-h-11 rounded-lg border px-3 py-2 font-semibold disabled:opacity-50">{t.submit}</button>
  </form>
  {sending&&<p role="status" aria-live="polite" className="rounded-lg border p-3">{t.waiting}</p>}
  {result&&!sending&&<p role="status" aria-live="assertive" className={"rounded-xl border p-4 text-lg font-black "+(result.ok?"border-green-600 text-green-600":"border-red-600 text-red-500")}>{result.ok?t.success:errorText}</p>}
  <p className="text-xs text-muted-foreground">{t.info} {t.permission}</p>
  <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-semibold">{t.fallback}</summary>
   <div className="mt-2 flex flex-wrap gap-2">
    <a href={WEEZTIX_SCANNER_LINKS.ios} target="_blank" rel="noopener noreferrer" className="rounded border px-3 py-2 text-sm">iPhone</a>
    <a href={WEEZTIX_SCANNER_LINKS.android} target="_blank" rel="noopener noreferrer" className="rounded border px-3 py-2 text-sm">Android</a>
    <a href={WEEZTIX_SCANNER_LINKS.help} target="_blank" rel="noopener noreferrer" className="rounded border px-3 py-2 text-sm">{t.fallback}</a>
   </div>
  </details>
 </section>
}
