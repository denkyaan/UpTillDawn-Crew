"use client"
import {useCallback,useEffect,useRef,useState} from "react"
import type {SupportedUiLocale} from "@/lib/locale-preferences"
const labels={
 nl:{title:"Interne boekingsnotities wijzigen",id:"Boeking-ID",load:"Boeking ophalen",notes:"Nieuwe interne notities",save:"Bevestigen en opslaan",cancel:"Annuleren",success:"Notities opgeslagen.",error:"De wijziging kon niet worden uitgevoerd. Herlaad de boeking.",locked:"Geannuleerde boekingen zijn vergrendeld.",choose:"Kies een artiestenboeking",refresh:"Boekingen laden",audit:"Recente wijzigingen",before:"Vorige lengte",after:"Nieuwe lengte",changed:"Gewijzigd",preview:"Wijziging controleren",unchanged:"Geen wijzigingen",instruction:"Wat moet AI aan deze notities aanpassen?",generate:"AI-voorstel maken",proposed:"AI-voorstel klaar. Controleer vóór opslaan.",conflict:"Deze boeking werd ondertussen gewijzigd. Laad de nieuwste versie.",reload:"Opnieuw laden",draft:"Niet-opgeslagen wijzigingen",discard:"Wijzigingen wissen",leave:"Niet-opgeslagen wijzigingen verliezen?",added:"Toegevoegde regels",removed:"Verwijderde regels",search:"Zoek artiest",next:"Volgende",previous:"Vorige"},
 fr:{title:"Modifier les notes internes",id:"Identifiant de réservation",load:"Charger la réservation",notes:"Nouvelles notes internes",save:"Confirmer et enregistrer",cancel:"Annuler",success:"Notes enregistrées.",error:"Modification impossible. Rechargez la réservation.",locked:"Les réservations annulées sont verrouillées.",choose:"Choisir une réservation",refresh:"Charger les réservations",audit:"Modifications récentes",before:"Longueur précédente",after:"Nouvelle longueur",changed:"Modifié",preview:"Vérifier la modification",unchanged:"Aucune modification",instruction:"Quelle modification proposer ?",generate:"Générer une proposition IA",proposed:"Proposition prête. Vérifiez avant de sauvegarder.",conflict:"Cette réservation a changé. Rechargez la version actuelle.",reload:"Recharger",draft:"Modifications non enregistrées",discard:"Annuler les modifications",leave:"Abandonner les modifications non enregistrées ?",added:"Lignes ajoutées",removed:"Lignes supprimées",search:"Rechercher un artiste",next:"Suivant",previous:"Précédent"},
 en:{title:"Edit internal booking notes",id:"Booking ID",load:"Load booking",notes:"New internal notes",save:"Confirm and save",cancel:"Cancel",success:"Notes saved.",error:"Update failed. Reload the booking.",locked:"Cancelled bookings are locked.",choose:"Choose an artist booking",refresh:"Load bookings",audit:"Recent changes",before:"Previous length",after:"New length",changed:"Changed",preview:"Review changes",unchanged:"No changes",instruction:"What should AI change in these notes?",generate:"Generate AI proposal",proposed:"Proposal ready. Review before saving.",conflict:"This booking changed. Reload the latest version.",reload:"Reload",draft:"Unsaved changes",discard:"Discard changes",leave:"Discard unsaved changes?",added:"Added lines",removed:"Removed lines",search:"Search artist",next:"Next",previous:"Previous"},
 de:{title:"Interne Buchungsnotizen ändern",id:"Buchungs-ID",load:"Buchung laden",notes:"Neue interne Notizen",save:"Bestätigen und speichern",cancel:"Abbrechen",success:"Notizen gespeichert.",error:"Änderung fehlgeschlagen. Buchung neu laden.",locked:"Stornierte Buchungen sind gesperrt.",choose:"Künstlerbuchung auswählen",refresh:"Buchungen laden",audit:"Letzte Änderungen",before:"Vorherige Länge",after:"Neue Länge",changed:"Geändert",preview:"Änderung prüfen",unchanged:"Keine Änderungen",instruction:"Was soll die KI an diesen Notizen ändern?",generate:"KI-Vorschlag erstellen",proposed:"Vorschlag bereit. Vor dem Speichern prüfen.",conflict:"Diese Buchung wurde geändert. Neu laden.",reload:"Neu laden",draft:"Ungespeicherte Änderungen",discard:"Änderungen verwerfen",leave:"Ungespeicherte Änderungen verwerfen?",added:"Hinzugefügte Zeilen",removed:"Entfernte Zeilen",search:"Künstler suchen",next:"Weiter",previous:"Zurück"}
} as const
type AuditEntry={id:string;actor_id:string|null;changed_at:string;previous_length:number;new_length:number}
const editableNotes=(value:string|null)=>(value??"").split("\n").filter(line=>!/^\[\d{4}-\d{2}-\d{2}T.*\] \[(email_sent|reply_received|follow_up)\] \[[0-9a-f-]{36}\] /.test(line)).join("\n")
type Booking={id:string;artist_name:string;status:string;internal_notes:string|null}
export function AdministrationAiBookingNotes({locale,initialBookingId}:{locale:SupportedUiLocale;initialBookingId?:string}){
 const t=labels[locale]
 const [id,setId]=useState(initialBookingId??"")
 const [booking,setBooking]=useState<Booking|null>(null)
 const [audit,setAudit]=useState<AuditEntry[]>([])
 const [choices,setChoices]=useState<Array<Pick<Booking,"id"|"artist_name"|"status">>>([])
 const [search,setSearch]=useState("")
 const [page,setPage]=useState(0)
 const [hasMore,setHasMore]=useState(false)
 const [notes,setNotes]=useState("")
 const [instruction,setInstruction]=useState("")
 const [busy,setBusy]=useState(false)
 const [feedback,setFeedback]=useState("")
 const [conflict,setConflict]=useState(false)
 const busyRef=useRef(false)
 const initialLoadRef=useRef<string|null>(null)
 const selectionRef=useRef(initialBookingId??"")
 const requestRef=useRef(0)
 const hasDraft=Boolean(booking&&notes!==editableNotes(booking.internal_notes))
 const originalLines=booking?editableNotes(booking.internal_notes).split("\n"):[]
 const draftLines=notes.split("\n")
 const addedLines=draftLines.filter(line=>line&&!originalLines.includes(line))
 const removedLines=originalLines.filter(line=>line&&!draftLines.includes(line))
 function mayLeave(){return !hasDraft||window.confirm(t.leave)}
 function chooseBooking(targetId:string){
  if(targetId===id)return
  if(!mayLeave())return
  ++requestRef.current;selectionRef.current=targetId;setId(targetId);setBooking(null);setNotes("");setInstruction("");setConflict(false)
  if(targetId)void load(targetId)
 }
 const load=useCallback(async (targetId:string)=>{
  if(busyRef.current)return
  busyRef.current=true
  const requestId=++requestRef.current
  selectionRef.current=targetId
  setBusy(true);setFeedback("");setConflict(false);setBooking(null)
  try{
   const response=await fetch("/api/administration/assistant/booking-notes?bookingId="+encodeURIComponent(targetId),{cache:"no-store"})
   const payload=await response.json() as {booking?:Booking;audit?:AuditEntry[]|null}
   if(selectionRef.current!==targetId||requestRef.current!==requestId)return
   if(!response.ok||!payload.booking){setFeedback(t.error);return}
   setBooking(payload.booking)
   setAudit(payload.audit??[])
   setNotes(editableNotes(payload.booking.internal_notes))
  }catch{if(selectionRef.current===targetId&&requestRef.current===requestId)setFeedback(t.error)}finally{busyRef.current=false;setBusy(false)}
 },[t.error])
 useEffect(()=>{if(initialBookingId&&initialLoadRef.current!==initialBookingId&&/^[0-9a-f-]{36}$/i.test(initialBookingId)){initialLoadRef.current=initialBookingId;queueMicrotask(()=>{void load(initialBookingId)})}},[initialBookingId,load])
 async function listBookings(nextPage=0){
  if(busy)return
  setBusy(true);setFeedback("")
  try{
   const response=await fetch("/api/administration/assistant/booking-notes?search="+encodeURIComponent(search.trim())+"&page="+nextPage,{cache:"no-store"})
   const payload=await response.json() as {bookings?:Array<Pick<Booking,"id"|"artist_name"|"status">>;hasMore?:boolean}
   if(!response.ok||!payload.bookings){setFeedback(t.error);return}
   setChoices(payload.bookings);setPage(nextPage);setHasMore(Boolean(payload.hasMore))
  }catch{setFeedback(t.error)}finally{setBusy(false)}
 }
 async function propose(){
  if(!booking||busy||conflict||!instruction.trim())return
  if(!mayLeave())return
  const targetId=booking.id
  const requestId=++requestRef.current
  setBusy(true);setFeedback("")
  try{
   const response=await fetch("/api/administration/assistant/booking-notes/propose",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({bookingId:booking.id,instruction,locale})})
   const payload=await response.json() as {notes?:string;expectedNotes?:string|null;unchanged?:boolean}
   if(selectionRef.current!==targetId||requestRef.current!==requestId)return
   if(!response.ok||typeof payload.notes!=="string"||payload.expectedNotes!==booking.internal_notes){setFeedback(t.error);return}
   setNotes(payload.notes);setFeedback(payload.unchanged?t.unchanged:t.proposed)
  }catch{if(selectionRef.current===targetId&&requestRef.current===requestId)setFeedback(t.error)}finally{setBusy(false)}
 }
 async function save(){
  if(!booking||busy||conflict||booking.status==="cancelled")return
  const targetId=booking.id
  const requestId=++requestRef.current
  setBusy(true);setFeedback("")
  try{
   const response=await fetch("/api/administration/assistant/booking-notes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({bookingId:booking.id,expectedNotes:booking.internal_notes,notes,confirmed:true})})
   if(selectionRef.current!==targetId||requestRef.current!==requestId)return
   if(response.status===409){setConflict(true);setFeedback(t.conflict);return}
   if(!response.ok){setFeedback(t.error);return}
   const result=await response.json() as {saved?:boolean;unchanged?:boolean}
   if(result.unchanged){setFeedback(t.unchanged);return}
   if(!result.saved){setFeedback(t.error);return}
   setBooking(null);setNotes("");setFeedback(t.success)
  }catch{if(selectionRef.current===targetId&&requestRef.current===requestId)setFeedback(t.error)}finally{setBusy(false)}
 }
 return <section className="space-y-3 rounded-2xl border bg-card p-5">
  <h2 className="text-lg font-semibold">{t.title}</h2>
  <form onSubmit={event=>{event.preventDefault();void listBookings(0)}} className="flex flex-wrap items-end gap-2"><label className="min-w-0 flex-1 text-sm">{t.search}<input value={search} maxLength={80} onChange={event=>setSearch(event.target.value)} className="mt-1 w-full rounded-lg border bg-background p-2"/></label><button type="submit" disabled={busy} className="rounded-lg border px-3 py-2 text-sm">{t.refresh}</button></form>
  <div className="flex flex-wrap items-end gap-2"><label className="min-w-0 flex-1 text-sm">{t.choose}<select value={choices.some(item=>item.id===id)?id:""} onChange={event=>chooseBooking(event.target.value)} className="mt-1 w-full rounded-lg border bg-background p-2"><option value="">{t.choose}</option>{choices.map(item=><option key={item.id} value={item.id}>{item.artist_name} · {item.status}</option>)}</select></label><button type="button" disabled={busy||page===0} onClick={()=>void listBookings(page-1)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">{t.previous}</button><button type="button" disabled={busy||!hasMore} onClick={()=>void listBookings(page+1)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">{t.next}</button></div>
  <form onSubmit={event=>{event.preventDefault();if(mayLeave())void load(id)}} className="flex flex-wrap gap-2">
   <label className="min-w-0 flex-1 text-sm">{t.id}<input value={id} onChange={event=>chooseBooking(event.target.value)} required maxLength={36} className="mt-1 w-full rounded-lg border bg-background p-2"/></label>
   <button type="submit" disabled={busy} className="self-end rounded-lg border px-3 py-2 text-sm disabled:opacity-50">{t.load}</button>
  </form>
  {booking&&<div className="space-y-3 rounded-xl border p-3">
   <p className="font-semibold">{booking.artist_name}</p>
   {booking.status==="cancelled"?<p role="alert">{t.locked}</p>:<>
    {notes!==editableNotes(booking.internal_notes)&&<p role="status" className="text-xs font-semibold text-amber-600">{t.draft}</p>}
    {conflict&&<div role="alert" className="flex flex-wrap items-center gap-2"><p>{t.conflict}</p><button type="button" onClick={()=>void load(booking.id)} className="rounded-lg border px-3 py-2 text-sm">{t.reload}</button></div>}
    <label className="block text-sm">{t.instruction}<textarea rows={2} maxLength={1000} value={instruction} onChange={event=>setInstruction(event.target.value)} className="mt-1 w-full rounded-lg border bg-background p-2"/></label><button type="button" disabled={busy||conflict||instruction.trim().length<5} onClick={()=>void propose()} className="rounded-lg border border-violet-500 px-3 py-2 text-sm disabled:opacity-50">{t.generate}</button>
    <label className="block text-sm">{t.notes}<textarea rows={5} maxLength={5000} value={notes} onChange={event=>setNotes(event.target.value)} className="mt-1 w-full rounded-lg border bg-background p-2"/></label>
    <div className="rounded-lg border p-3 text-sm"><p className="font-semibold">{t.preview}</p><p className="text-xs">{t.added}: {addedLines.length} · {t.removed}: {removedLines.length}</p><p className="whitespace-pre-wrap break-words text-muted-foreground">{booking.internal_notes??"—"}</p><hr className="my-2"/><p className="whitespace-pre-wrap break-words">{notes||"—"}</p></div>
    <div className="flex flex-wrap gap-2"><button type="button" disabled={busy||conflict||notes===editableNotes(booking.internal_notes)} onClick={()=>void save()} className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{t.save}</button><button type="button" disabled={busy} onClick={()=>{setNotes(editableNotes(booking.internal_notes));setInstruction("");setFeedback("")}} className="rounded-lg border px-3 py-2 text-sm">{t.discard}</button><button type="button" disabled={busy} onClick={()=>{if(mayLeave()){setBooking(null);setNotes("");setInstruction("")}}} className="rounded-lg border px-3 py-2 text-sm">{t.cancel}</button></div>
   </>}
  </div>}
  {booking&&audit.length>0&&<section className="space-y-2 rounded-xl border p-3"><h3 className="font-semibold">{t.audit}</h3><ol className="space-y-1 text-xs">{audit.map(entry=><li key={entry.id}>{new Date(entry.changed_at).toLocaleString()} · {t.before}: {entry.previous_length} · {t.after}: {entry.new_length}</li>)}</ol></section>}
  {feedback&&<p role="status" className="text-sm">{feedback}</p>}
 </section>
}
