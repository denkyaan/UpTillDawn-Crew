"use client"
import {useEffect,useRef,useState,type ChangeEvent} from "react"
import {useRouter} from "next/navigation"
import {validateTicketSalesCsv} from "@/lib/administration/ticket-import"
import type {SupportedUiLocale} from "@/lib/locale-preferences"

type Mapping={id:string;provider:"eventix"|"sumup";external_event_id:string;event_id:string;enabled:boolean}
type EventChoice={id:string;name:string}
const copy={
 nl:{title:"Gekoppelde Eventix / SumUp CSV-import",intro:"Importeer genormaliseerde CSV-verkoopregels via een geactiveerde evenementkoppeling. Het externe evenement-ID wordt gecontroleerd en automatisch gekoppeld aan het interne evenement. Dit is geen live API-synchronisatie.",mapping:"Actieve evenementkoppeling",event:"Intern evenement",file:"CSV-bestand (max. 2 MB)",template:"CSV-sjabloon voor deze koppeling",refresh:"Koppelingen vernieuwen",loading:"Koppelingen laden…",empty:"Geen actieve koppelingen gevonden. Voeg eerst een koppeling toe en activeer deze hierboven.",error:"Koppelingen konden niet worden geladen.",invalid:"Bestand ongeldig. Controleer het externe evenement-ID, de kolommen, bedragen en tijdstippen.",valid:"CSV gecontroleerd",rows:"Verkopen",tickets:"Tickets",gross:"Bruto omzet",import:"Gekoppelde verkopen importeren",busy:"Verkopen opslaan…",saved:"Opgeslagen",skipped:"Identieke verkopen overgeslagen",conflict:"De koppeling is niet meer actief of de verkoop bevat tegenstrijdige gegevens. Er is niets opgeslagen.",failed:"Import mislukt. Vernieuw de koppelingen en controleer het bestand."},
 fr:{title:"Import CSV Eventix / SumUp associé",intro:"Importez des ventes CSV normalisées via une association d’événement active. L’identifiant externe est vérifié et relié à l’événement interne. Ce n’est pas une synchronisation API en direct.",mapping:"Association d’événement active",event:"Événement interne",file:"Fichier CSV (max. 2 Mo)",template:"Modèle CSV pour cette association",refresh:"Actualiser les associations",loading:"Chargement des associations…",empty:"Aucune association active. Créez et activez d’abord une association ci-dessus.",error:"Impossible de charger les associations.",invalid:"Fichier non valide. Vérifiez l’ID événement externe, les colonnes, les montants et les dates.",valid:"CSV vérifié",rows:"Ventes",tickets:"Billets",gross:"Recettes brutes",import:"Importer les ventes associées",busy:"Enregistrement des ventes…",saved:"Enregistrées",skipped:"Doublons identiques ignorés",conflict:"Association inactive ou données de vente contradictoires. Aucun enregistrement.",failed:"Échec de l’import. Actualisez les associations et vérifiez le fichier."},
 en:{title:"Mapped Eventix / SumUp CSV import",intro:"Import normalized sales CSV through an enabled event mapping. The external event ID is verified and resolved to the internal event. This is not live API synchronization.",mapping:"Active event mapping",event:"Internal event",file:"CSV file (max 2 MB)",template:"CSV template for this mapping",refresh:"Refresh mappings",loading:"Loading mappings…",empty:"No active mappings. Create and activate a mapping above first.",error:"Unable to load mappings.",invalid:"Invalid file. Check the external event ID, columns, amounts and timestamps.",valid:"CSV validated",rows:"Sales",tickets:"Tickets",gross:"Gross revenue",import:"Import mapped sales",busy:"Saving sales…",saved:"Saved",skipped:"Identical sales skipped",conflict:"Mapping is no longer active or a sale conflicts with stored data. Nothing was saved.",failed:"Import failed. Refresh mappings and check the file."},
 de:{title:"Zugeordneter Eventix / SumUp CSV-Import",intro:"Normierte CSV-Verkäufe über eine aktivierte Eventzuordnung importieren. Die externe Event-ID wird geprüft und dem internen Event zugeordnet. Keine Live-API-Synchronisierung.",mapping:"Aktive Eventzuordnung",event:"Internes Event",file:"CSV-Datei (max. 2 MB)",template:"CSV-Vorlage für diese Zuordnung",refresh:"Zuordnungen aktualisieren",loading:"Zuordnungen laden…",empty:"Keine aktiven Zuordnungen. Zuerst oben eine Zuordnung erstellen und aktivieren.",error:"Zuordnungen konnten nicht geladen werden.",invalid:"Ungültige Datei. Externe Event-ID, Spalten, Beträge und Zeitstempel prüfen.",valid:"CSV geprüft",rows:"Verkäufe",tickets:"Tickets",gross:"Bruttoumsatz",import:"Zugeordnete Verkäufe importieren",busy:"Verkäufe speichern…",saved:"Gespeichert",skipped:"Identische Verkäufe übersprungen",conflict:"Zuordnung nicht mehr aktiv oder ein Verkauf widerspricht gespeicherten Daten. Nichts gespeichert.",failed:"Import fehlgeschlagen. Zuordnungen aktualisieren und Datei prüfen."},
} as const

export default function MappedTicketImportPreview({events,locale}:{events:EventChoice[];locale:SupportedUiLocale}){
 const t=copy[locale],router=useRouter(),revision=useRef(0)
 const [mappings,setMappings]=useState<Mapping[]>([])
 const [mappingId,setMappingId]=useState("")
 const [loadState,setLoadState]=useState<"loading"|"ready"|"error">("loading")
 const [file,setFile]=useState<File|null>(null),[csv,setCsv]=useState<string|null>(null)
 const [feedback,setFeedback]=useState(""),[busy,setBusy]=useState(false)

 async function loadMappings(signal?:AbortSignal){
  setLoadState("loading")
  try{
   const response=await fetch("/api/administration/provider-mappings",{cache:"no-store",signal})
   if(!response.ok)throw Error("Mapping request failed")
   const body:unknown=await response.json()
   if(!body||typeof body!=="object"||!Array.isArray((body as {mappings?:unknown}).mappings))throw Error("Invalid mappings")
   const active=((body as {mappings:unknown[]}).mappings).filter((value):value is Mapping=>{
    if(!value||typeof value!=="object")return false
    const row=value as Record<string,unknown>
    return typeof row.id==="string"&&/^[0-9a-f-]{36}$/i.test(row.id)
     &&(row.provider==="eventix"||row.provider==="sumup")
     &&typeof row.external_event_id==="string"&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/.test(row.external_event_id)
     &&typeof row.event_id==="string"&&/^[0-9a-f-]{36}$/i.test(row.event_id)
     &&row.enabled===true
   })
   if(signal?.aborted)return
   setMappings(active)
   setMappingId(previous=>active.some(mapping=>mapping.id===previous)?previous:active[0]?.id??"")
   setLoadState("ready")
  }catch{
   if(!signal?.aborted)setLoadState("error")
  }
 }
 useEffect(()=>{const controller=new AbortController();void loadMappings(controller.signal);return ()=>controller.abort()},[])
 const selected=mappings.find(mapping=>mapping.id===mappingId)??null
 const eventName=events.find(event=>event.id===selected?.event_id)?.name??selected?.event_id??""
 const result=selected&&csv!==null?validateTicketSalesCsv(csv,selected.event_id,10000,selected.external_event_id):null
 function clearFile(){revision.current++;setFile(null);setCsv(null);setFeedback("")}
 async function onFileChange(event:ChangeEvent<HTMLInputElement>){
  const chosen=event.target.files?.[0],version=++revision.current
  setFile(null);setCsv(null);setFeedback("")
  if(!chosen)return
  if(chosen.size===0||chosen.size>2_000_000||!chosen.name.toLowerCase().endsWith(".csv")){setFeedback(t.invalid);return}
  try{
   const content=await chosen.text()
   if(version===revision.current){setCsv(content);setFile(chosen)}
  }catch{if(version===revision.current)setFeedback(t.invalid)}
 }
 async function save(){
  if(busy||!selected||!file||!result||result.errors.length||!result.rows.length)return
  setBusy(true);setFeedback("")
  const form=new FormData()
  form.set("mappingId",selected.id)
  form.set("externalEventId",selected.external_event_id)
  form.set("eventId",selected.event_id)
  form.set("source",selected.provider)
  form.set("file",file)
  try{
   const response=await fetch("/api/administration/ticketing/import",{method:"POST",body:form})
   const body=await response.json().catch(()=>({}))
   if(!response.ok){setFeedback(response.status===409?t.conflict:t.failed);return}
   if(!body.result||!Number.isSafeInteger(body.result.inserted)||!Number.isSafeInteger(body.result.skipped)){setFeedback(t.failed);return}
   setFeedback(t.saved+": "+body.result.inserted+" · "+t.skipped+": "+body.result.skipped)
   router.refresh()
  }catch{setFeedback(t.failed)}finally{setBusy(false)}
 }
 const template=selected
  ?"external_id,external_event_id,quantity,gross_amount,currency,sold_at\n"
   +"EXAMPLE-001,"+selected.external_event_id+",2,30.00,EUR,2026-10-30T20:00:00+01:00\n"
  :""
 return <section className="space-y-3 rounded-2xl border bg-card p-5" aria-label={t.title}>
  <h2 className="text-lg font-semibold">{t.title}</h2>
  <p className="text-sm text-muted-foreground">{t.intro}</p>
  <button type="button" disabled={busy||loadState==="loading"} onClick={()=>{clearFile();void loadMappings()}} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">{t.refresh}</button>
  {loadState==="loading"&&<p role="status">{t.loading}</p>}
  {loadState==="error"&&<p role="alert">{t.error}</p>}
  {loadState==="ready"&&!mappings.length&&<p role="status" className="text-sm">{t.empty}</p>}
  {loadState==="ready"&&selected&&<>
   <label className="grid gap-1 text-sm">{t.mapping}
    <select value={mappingId} disabled={busy} onChange={event=>{clearFile();setMappingId(event.target.value)}} className="w-full rounded-lg border bg-background p-2">
     {mappings.map(mapping=><option key={mapping.id} value={mapping.id}>{mapping.provider==="eventix"?"Eventix":"SumUp"} · {mapping.external_event_id} · {events.find(event=>event.id===mapping.event_id)?.name??mapping.event_id}</option>)}
    </select>
   </label>
   <p className="text-sm">{t.event}: <strong>{eventName}</strong></p>
   <label className="grid gap-1 text-sm">{t.file}<input key={mappingId} type="file" accept=".csv,text/csv" disabled={busy} onChange={onFileChange} className="max-w-full rounded-lg border p-2"/></label>
   <a href={"data:text/csv;charset=utf-8,"+encodeURIComponent(template)} download="mapped-ticket-sales-example.csv" className="inline-block text-sm text-violet-400 underline">{t.template}</a>
   {result&&<div role="status">{result.errors.length?<p>{t.invalid} ({result.errors.slice(0,20).map(e=>e.line).join(", ")})</p>
    :<><p className="font-semibold">{t.valid}</p><p className="text-sm">{t.rows}: {result.rows.length} · {t.tickets}: {result.quantity} · {t.gross}: {(result.grossCents/100).toLocaleString(locale,{style:"currency",currency:"EUR"})}</p></>}</div>}
   <button type="button" disabled={busy||!file||!result||result.errors.length>0||!result.rows.length} onClick={()=>void save()} className="rounded-lg bg-violet-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy?t.busy:t.import}</button>
  </>}
  {feedback&&<p role="status" className="text-sm">{feedback}</p>}
 </section>
}
