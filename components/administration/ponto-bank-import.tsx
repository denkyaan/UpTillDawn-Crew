"use client"
import {useEffect,useState} from "react"
import type {SupportedUiLocale} from "@/lib/locale-preferences"
import {activeUiLocale,LANGUAGE_APPLIED_EVENT} from "@/lib/locale-preferences"

type Account={id:string}
type Result={inserted:number;skipped:number;nextCursor:string|null}
const copy={
 nl:{title:"Ponto",intro:"Haal geboekte banktransacties veilig op. Alleen nieuwe bankregels worden toegevoegd voor controle; facturen worden niet automatisch betaald gemarkeerd.",loading:"Rekeningen laden…",loadFailed:"Rekeningen ophalen mislukt. Controleer de Ponto-verbinding of banktoestemming.",notConfigured:"Stel Ponto eerst in bij Bankzaken.",noAccount:"Nog geen bankrekening vrijgegeven in Ponto.",account:"Rekening kiezen",import:"Banktransacties ophalen",more:"Volgende 100 transacties",working:"Ophalen…",saved:"Nieuw toegevoegd",skipped:"Reeds aanwezig",error:"Import mislukt. Controleer je toegang en de providergegevens.",invalid:"Ponto heeft gegevens teruggegeven die niet veilig konden worden verwerkt. Er is niets opgeslagen.",done:"Dit was de laatste batch.",refresh:"Rekeningen vernieuwen"},
 fr:{title:"Ponto",intro:"Importez les opérations comptabilisées. Seules les nouvelles écritures sont proposées à la vérification ; aucune facture n'est payée automatiquement.",loading:"Chargement des comptes…",loadFailed:"Impossible de charger les comptes. Vérifiez Ponto ou l'autorisation bancaire.",notConfigured:"Configurez d'abord Ponto dans Banque.",noAccount:"Aucun compte bancaire autorisé dans Ponto.",account:"Choisir le compte",import:"Importer les opérations",more:"100 opérations suivantes",working:"Importation…",saved:"Nouvelles écritures",skipped:"Déjà enregistrées",error:"Import impossible. Vérifiez les autorisations et les données du fournisseur.",invalid:"Ponto a renvoyé des données incompatibles. Aucun enregistrement n'a été créé.",done:"Dernier lot importé.",refresh:"Actualiser les comptes"},
 en:{title:"Ponto",intro:"Fetch booked bank transactions. Only new statement rows are added for review; invoices are never marked paid automatically.",loading:"Loading accounts…",loadFailed:"Could not load accounts. Check your Ponto connection or account consent.",notConfigured:"Configure Ponto under Banking first.",noAccount:"No bank account has been authorized in Ponto.",account:"Choose account",import:"Fetch bank transactions",more:"Fetch next 100 transactions",working:"Fetching…",saved:"Newly added",skipped:"Already imported",error:"Import failed. Check access and provider data.",invalid:"Ponto returned incompatible records. Nothing was saved.",done:"Final batch imported.",refresh:"Refresh accounts"},
 de:{title:"Ponto",intro:"Gebuchte Bankbewegungen einlesen. Neue Kontoauszugszeilen müssen geprüft werden; Rechnungen werden niemals automatisch als bezahlt markiert.",loading:"Konten werden geladen…",loadFailed:"Konten konnten nicht geladen werden. Ponto-Zugang oder Zustimmung prüfen.",notConfigured:"Ponto zuerst unter Bank einrichten.",noAccount:"Keine Bankkonten in Ponto freigegeben.",account:"Konto wählen",import:"Bankbuchungen abrufen",more:"Nächste 100 Buchungen",working:"Wird abgerufen…",saved:"Neu hinzugefügt",skipped:"Bereits vorhanden",error:"Import fehlgeschlagen. Berechtigungen und Providerdaten prüfen.",invalid:"Ponto hat ungültige Daten geliefert. Es wurde nichts gespeichert.",done:"Letzter Stapel importiert.",refresh:"Konten aktualisieren"}
} as const
const idPattern=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
export default function PontoBankImport({initialLocale}:{initialLocale:SupportedUiLocale}){
 const [locale,setLocale]=useState(initialLocale),[accounts,setAccounts]=useState<Account[]>([])
 const [accountId,setAccountId]=useState(""),[cursor,setCursor]=useState<string|null>(null)
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false)
 const [issue,setIssue]=useState(""),[result,setResult]=useState<Result|null>(null)
 useEffect(()=>{
  const apply=()=>setLocale(activeUiLocale())
  apply();window.addEventListener(LANGUAGE_APPLIED_EVENT,apply)
  return()=>window.removeEventListener(LANGUAGE_APPLIED_EVENT,apply)
 },[])
 async function loadAccounts(signal?:AbortSignal){
  setLoading(true);setIssue("");setResult(null)
  try{
   const response=await fetch("/api/administration/integrations/ponto",{credentials:"same-origin",cache:"no-store",signal})
   if(!response.ok){setIssue(response.status===409?"not_configured":"load_failed");return}
   const data:unknown=await response.json()
   if(!data||typeof data!=="object"||!("accounts" in data)||!Array.isArray(data.accounts)||
      data.accounts.some((a:unknown)=>!a||typeof a!=="object"||!("id" in a)))throw Error("Invalid accounts")
   const valid=data.accounts as Account[]
   if(valid.some(a=>typeof a.id!=="string"||!idPattern.test(a.id)))throw Error("Invalid accounts")
   setAccounts(valid)
   setAccountId(previous=>valid.some(a=>a.id===previous)?previous:valid[0]?.id??"")
   setCursor(null)
  }catch{if(!signal?.aborted)setIssue("load_failed")}
  finally{if(!signal?.aborted)setLoading(false)}
 }
 useEffect(()=>{const controller=new AbortController();void Promise.resolve().then(()=>loadAccounts(controller.signal));return()=>controller.abort()},[])
 async function importPage(){
  if(!idPattern.test(accountId)||busy)return
  setBusy(true);setIssue("");setResult(null)
  try{
   const response=await fetch("/api/administration/integrations/ponto",{
    method:"POST",headers:{"Content-Type":"application/json"},
    credentials:"same-origin",cache:"no-store",
    body:JSON.stringify({accountId,after:cursor})
   })
   const data:unknown=await response.json()
   if(!response.ok){
    setIssue(response.status===422?"invalid":"error");return
   }
   if(!data||typeof data!=="object"||!("inserted" in data)||!("skipped" in data)||
      !("nextCursor" in data)||typeof data.inserted!=="number"||typeof data.skipped!=="number"||
      (data.nextCursor!==null&&(typeof data.nextCursor!=="string"||!idPattern.test(data.nextCursor))))throw Error("Invalid result")
   const next=data as Result
   setResult(next);setCursor(next.nextCursor)
   if(next.inserted>0)window.dispatchEvent(new Event("uptilldawn-ponto-imported"))
  }catch{setIssue("error")}
  finally{setBusy(false)}
 }
 const t=copy[locale]
 return <section aria-label={t.title} className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5">
  <h3 className="text-base font-semibold">{t.title}</h3>
  <p className="text-xs leading-5 text-muted-foreground">{t.intro}</p>
  {loading?<p role="status" className="text-sm">{t.loading}</p>:
   <div className="space-y-3">
    {accounts.length>0&&<label className="block space-y-1 text-sm">
     <span>{t.account}</span>
     <select className="min-h-11 w-full rounded-lg border bg-background px-3" value={accountId}
      disabled={busy} onChange={e=>{setAccountId(e.target.value);setCursor(null);setResult(null)}}>
      {accounts.map((a,index)=><option key={a.id} value={a.id}>{t.account} {index+1} · …{a.id.slice(-6)}</option>)}
     </select>
    </label>}
    {accounts.length===0&&!issue&&<p className="text-sm text-muted-foreground">{t.noAccount}</p>}
    <div className="flex flex-wrap gap-2">
     <button type="button" disabled={busy||accounts.length===0||(result!==null&&result.nextCursor===null)}
      className="min-h-11 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      onClick={()=>void importPage()}>{busy?t.working:cursor?t.more:t.import}</button>
     <button type="button" disabled={busy} className="min-h-11 rounded-lg border px-3 py-2 text-xs font-medium"
      onClick={()=>void loadAccounts()}>{t.refresh}</button>
    </div>
    {result&&<p role="status" className="text-sm">{t.saved}: {result.inserted} · {t.skipped}: {result.skipped}{result.nextCursor===null?" · "+t.done:""}</p>}
   </div>}
  {issue&&<p role="alert" className="text-sm text-amber-600">{issue==="not_configured"?t.notConfigured:issue==="invalid"?t.invalid:issue==="load_failed"?t.loadFailed:t.error}</p>}
 </section>
}
