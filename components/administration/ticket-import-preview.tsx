"use client"
import {useRef,useState,type ChangeEvent} from "react"
import {useRouter} from "next/navigation"
import {validateTicketSalesCsv} from "@/lib/administration/ticket-import"
import type {SupportedUiLocale} from "@/lib/locale-preferences"
const copy={
 nl:{title:"Ticketverkoop importeren",event:"Evenement",source:"Verkoopkanaal",file:"CSV-bestand (max. 2 MB)",valid:"Bestand gecontroleerd",invalid:"Controleer de kolommen, unieke verkoop-ID’s, evenement, EUR-bedragen en tijdstippen met tijdzone.",sales:"Verkoopregels",tickets:"Tickets",gross:"Bruto omzet",intro:"Identieke verkopen worden overgeslagen. Afwijkende duplicaten blokkeren de hele import. Gebruik bij elke import dezelfde kanaalnaam.",empty:"Selecteer een evenement en een CSV-bestand.",error:"Import mislukt. Controleer het bestand en je toegang en probeer opnieuw.",save:"Verkopen opslaan",busy:"Bezig met opslaan…",saved:"Opgeslagen",skipped:"Duplicaten overgeslagen",template:"CSV-voorbeeld downloaden",conflict:"Een verkoop bestaat al met andere gegevens. Er is niets opgeslagen."},
 fr:{title:"Importer les ventes de billets",event:"Événement",source:"Canal de vente",file:"Fichier CSV (max. 2 Mo)",valid:"Fichier vérifié",invalid:"Vérifiez les colonnes, identifiants uniques, événement, montants EUR et dates avec fuseau horaire.",sales:"Ventes",tickets:"Billets",gross:"Recettes brutes",intro:"Les doublons identiques sont ignorés. Un doublon différent annule tout l’import. Utilisez toujours le même nom de canal.",empty:"Choisissez un événement et un fichier CSV.",error:"Échec de l’import. Vérifiez le fichier et vos droits puis réessayez.",save:"Enregistrer les ventes",busy:"Enregistrement…",saved:"Enregistrées",skipped:"Doublons ignorés",template:"Télécharger un exemple CSV",conflict:"Une vente existe avec des données différentes. Aucune donnée enregistrée."},
 en:{title:"Import ticket sales",event:"Event",source:"Sales channel",file:"CSV file (max 2 MB)",valid:"File checked",invalid:"Check columns, unique sale IDs, event, EUR amounts and timestamps with time zones.",sales:"Sales rows",tickets:"Tickets",gross:"Gross revenue",intro:"Identical sales are skipped. Conflicting duplicates reject the entire import. Keep the same channel name for every import.",empty:"Select an event and a CSV file.",error:"Import failed. Check the file and your access, then retry.",save:"Save sales",busy:"Saving…",saved:"Saved",skipped:"Duplicates skipped",template:"Download CSV example",conflict:"A sale exists with different data. Nothing was saved."},
 de:{title:"Ticketverkäufe importieren",event:"Veranstaltung",source:"Verkaufskanal",file:"CSV-Datei (max. 2 MB)",valid:"Datei geprüft",invalid:"Spalten, eindeutige Verkaufs-IDs, Veranstaltung, EUR-Beträge und Zeitstempel mit Zeitzone prüfen.",sales:"Verkäufe",tickets:"Tickets",gross:"Bruttoumsatz",intro:"Identische Verkäufe werden übersprungen. Abweichende Duplikate brechen den Import ab. Immer denselben Kanalnamen verwenden.",empty:"Veranstaltung und CSV-Datei auswählen.",error:"Import fehlgeschlagen. Datei und Berechtigungen prüfen und erneut versuchen.",save:"Verkäufe speichern",busy:"Wird gespeichert…",saved:"Gespeichert",skipped:"Duplikate übersprungen",template:"CSV-Beispiel herunterladen",conflict:"Ein Verkauf existiert mit anderen Daten. Nichts wurde gespeichert."},
} as const
export default function TicketImportPreview({events,locale}:{events:{id:string;name:string}[];locale:SupportedUiLocale}){
 const t=copy[locale],router=useRouter(),revision=useRef(0)
 const [eventId,setEventId]=useState(events[0]?.id??""),[source,setSource]=useState("ticketplatform")
 const [csv,setCsv]=useState<string|null>(null),[file,setFile]=useState<File|null>(null)
 const [feedback,setFeedback]=useState(""),[busy,setBusy]=useState(false)
 const result=csv!==null&&eventId?validateTicketSalesCsv(csv,eventId):null
 async function onFileChange(e:ChangeEvent<HTMLInputElement>){
  const chosen=e.target.files?.[0],version=++revision.current
  setCsv(null);setFile(null);setFeedback("")
  if(!chosen)return
  if(chosen.size>2_000_000||chosen.size===0||!chosen.name.toLowerCase().endsWith('.csv')){setFeedback(t.error);return}
  try{const text=await chosen.text();if(version===revision.current){setCsv(text);setFile(chosen)}}catch{if(version===revision.current)setFeedback(t.error)}
 }
 async function save(){
  if(busy||!file||!result||result.errors.length)return
  setBusy(true);setFeedback("")
  const form=new FormData();form.set("eventId",eventId);form.set("source",source);form.set("file",file)
  try{
   const response=await fetch("/api/administration/ticketing/import",{method:"POST",body:form})
   const body=await response.json()
   if(!response.ok){setFeedback(response.status===409?t.conflict:t.error);return}
   setFeedback(`${t.saved}: ${body.result.inserted} · ${t.skipped}: ${body.result.skipped}`);router.refresh()
  }catch{setFeedback(t.error)}finally{setBusy(false)}
 }
 const example=`external_id,event_id,quantity,gross_amount,currency,sold_at\nEXAMPLE-001,${eventId},2,30.00,EUR,2026-10-30T20:00:00+01:00\n`
 return <section className="rounded-2xl border bg-card p-5" aria-label={t.title}>
  <h2 className="text-lg font-semibold">{t.title}</h2><p className="mt-2 text-sm text-muted-foreground">{t.intro}</p>
  <div className="mt-4 grid gap-4 sm:grid-cols-2">
   <label className="grid gap-2 text-sm">{t.event}<select disabled={busy} className="rounded-lg border bg-background p-2" value={eventId} onChange={e=>{revision.current++;setEventId(e.target.value);setCsv(null);setFile(null);setFeedback("")}}>{events.map(event=><option key={event.id} value={event.id}>{event.name}</option>)}</select></label>
   <label className="grid gap-2 text-sm">{t.source}<input disabled={busy} maxLength={40} className="rounded-lg border bg-background p-2" value={source} onChange={e=>{setSource(e.target.value);setFeedback("")}}/></label>
   <label className="grid gap-2 text-sm">{t.file}<input key={eventId} disabled={busy||!eventId} type="file" accept=".csv,text/csv" onChange={onFileChange} className="max-w-full rounded-lg border p-2"/></label>
  </div>
  {eventId&&<a className="mt-3 inline-block text-sm text-violet-400 underline" href={'data:text/csv;charset=utf-8,'+encodeURIComponent(example)} download="ticket-sales-example.csv">{t.template}</a>}
  {result?<div className="mt-4" role="status">{result.errors.length?<p>{t.invalid} ({result.errors.slice(0,20).map(e=>e.line).join(', ')})</p>:<><p className="font-semibold">{t.valid}</p><p className="mt-2 text-sm">{t.sales}: {result.rows.length} · {t.tickets}: {result.quantity} · {t.gross}: {(result.grossCents/100).toLocaleString(locale,{style:"currency",currency:"EUR"})}</p></>}</div>:<p className="mt-3 text-sm text-muted-foreground">{t.empty}</p>}
  <button onClick={save} disabled={busy||!file||!result||Boolean(result.errors.length)||!/^[a-z0-9][a-z0-9_-]{0,39}$/.test(source)} className="mt-4 rounded-lg bg-violet-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy?t.busy:t.save}</button>
  {feedback&&<p role="status" className="mt-3 text-sm">{feedback}</p>}
 </section>
}
