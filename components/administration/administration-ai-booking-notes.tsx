"use client"
import {useCallback,useEffect,useRef,useState} from "react"
import type {SupportedUiLocale} from "@/lib/locale-preferences"
const labels={
 nl:{title:"Interne boekingsnotities wijzigen",id:"Boeking-ID",load:"Boeking ophalen",notes:"Nieuwe interne notities",save:"Bevestigen en opslaan",cancel:"Annuleren",success:"Notities opgeslagen.",error:"De wijziging kon niet worden uitgevoerd. Herlaad de boeking.",locked:"Geannuleerde boekingen zijn vergrendeld.",choose:"Kies een artiestenboeking",refresh:"Boekingen laden",audit:"Recente wijzigingen",before:"Vorige lengte",after:"Nieuwe lengte",changed:"Gewijzigd",preview:"Wijziging controleren",unchanged:"Geen wijzigingen"},
 fr:{title:"Modifier les notes internes",id:"Identifiant de réservation",load:"Charger la réservation",notes:"Nouvelles notes internes",save:"Confirmer et enregistrer",cancel:"Annuler",success:"Notes enregistrées.",error:"Modification impossible. Rechargez la réservation.",locked:"Les réservations annulées sont verrouillées.",choose:"Choisir une réservation",refresh:"Charger les réservations",audit:"Modifications récentes",before:"Longueur précédente",after:"Nouvelle longueur",changed:"Modifié",preview:"Vérifier la modification",unchanged:"Aucune modification"},
 en:{title:"Edit internal booking notes",id:"Booking ID",load:"Load booking",notes:"New internal notes",save:"Confirm and save",cancel:"Cancel",success:"Notes saved.",error:"Update failed. Reload the booking.",locked:"Cancelled bookings are locked.",choose:"Choose an artist booking",refresh:"Load bookings",audit:"Recent changes",before:"Previous length",after:"New length",changed:"Changed",preview:"Review changes",unchanged:"No changes"},
 de:{title:"Interne Buchungsnotizen ändern",id:"Buchungs-ID",load:"Buchung laden",notes:"Neue interne Notizen",save:"Bestätigen und speichern",cancel:"Abbrechen",success:"Notizen gespeichert.",error:"Änderung fehlgeschlagen. Buchung neu laden.",locked:"Stornierte Buchungen sind gesperrt.",choose:"Künstlerbuchung auswählen",refresh:"Buchungen laden",audit:"Letzte Änderungen",before:"Vorherige Länge",after:"Neue Länge",changed:"Geändert",preview:"Änderung prüfen",unchanged:"Keine Änderungen"}
} as const
type AuditEntry={id:string;actor_id:string|null;changed_at:string;previous_length:number;new_length:number}
type Booking={id:string;artist_name:string;status:string;internal_notes:string|null}
export function AdministrationAiBookingNotes({locale,initialBookingId}:{locale:SupportedUiLocale;initialBookingId?:string}){
 const t=labels[locale]
 const [id,setId]=useState(initialBookingId??"")
 const [booking,setBooking]=useState<Booking|null>(null)
 const [audit,setAudit]=useState<AuditEntry[]>([])
 const [choices,setChoices]=useState<Array<Pick<Booking,"id"|"artist_name"|"status">>>([])
 const [notes,setNotes]=useState("")
 const [busy,setBusy]=useState(false)
 const [feedback,setFeedback]=useState("")
 const busyRef=useRef(false)
 const initialLoadRef=useRef<string|null>(null)
 const load=useCallback(async (targetId:string)=>{
  if(busyRef.current)return
  busyRef.current=true
  setBusy(true);setFeedback("");setBooking(null)
  try{
   const response=await fetch("/api/administration/assistant/booking-notes?bookingId="+encodeURIComponent(targetId),{cache:"no-store"})
   const payload=await response.json() as {booking?:Booking;audit?:AuditEntry[]|null}
   if(!response.ok||!payload.booking){setFeedback(t.error);return}
   setBooking(payload.booking)
   setAudit(payload.audit??[])
   setNotes((payload.booking.internal_notes??"").split("\n").filter(line=>!/^\[\d{4}-\d{2}-\d{2}T.*\] \[(email_sent|reply_received|follow_up)\] \[[0-9a-f-]{36}\] /.test(line)).join("\n"))
  }catch{setFeedback(t.error)}finally{busyRef.current=false;setBusy(false)}
 },[t.error])
 useEffect(()=>{if(initialBookingId&&initialLoadRef.current!==initialBookingId&&/^[0-9a-f-]{36}$/i.test(initialBookingId)){initialLoadRef.current=initialBookingId;queueMicrotask(()=>{void load(initialBookingId)})}},[initialBookingId,load])
 async function listBookings(){
  if(busy)return
  setBusy(true);setFeedback("")
  try{
   const response=await fetch("/api/administration/assistant/booking-notes",{cache:"no-store"})
   const payload=await response.json() as {bookings?:Array<Pick<Booking,"id"|"artist_name"|"status">>}
   if(!response.ok||!payload.bookings){setFeedback(t.error);return}
   setChoices(payload.bookings)
  }catch{setFeedback(t.error)}finally{setBusy(false)}
 }
 async function save(){
  if(!booking||busy||booking.status==="cancelled")return
  setBusy(true);setFeedback("")
  try{
   const response=await fetch("/api/administration/assistant/booking-notes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({bookingId:booking.id,expectedNotes:booking.internal_notes,notes,confirmed:true})})
   if(!response.ok){setBooking(null);setFeedback(t.error);return}
   setBooking(null);setNotes("");setFeedback(t.success)
  }catch{setBooking(null);setFeedback(t.error)}finally{setBusy(false)}
 }
 return <section className="space-y-3 rounded-2xl border bg-card p-5">
  <h2 className="text-lg font-semibold">{t.title}</h2>
  <div className="flex flex-wrap items-end gap-2"><label className="min-w-0 flex-1 text-sm">{t.choose}<select value={choices.some(item=>item.id===id)?id:""} onChange={event=>{setId(event.target.value);setBooking(null);if(event.target.value)void load(event.target.value)}} className="mt-1 w-full rounded-lg border bg-background p-2"><option value="">{t.choose}</option>{choices.map(item=><option key={item.id} value={item.id}>{item.artist_name} · {item.status}</option>)}</select></label><button type="button" disabled={busy} onClick={()=>void listBookings()} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">{t.refresh}</button></div>
  <form onSubmit={event=>{event.preventDefault();void load(id)}} className="flex flex-wrap gap-2">
   <label className="min-w-0 flex-1 text-sm">{t.id}<input value={id} onChange={event=>{setId(event.target.value);setBooking(null)}} required maxLength={36} className="mt-1 w-full rounded-lg border bg-background p-2"/></label>
   <button type="submit" disabled={busy} className="self-end rounded-lg border px-3 py-2 text-sm disabled:opacity-50">{t.load}</button>
  </form>
  {booking&&<div className="space-y-3 rounded-xl border p-3">
   <p className="font-semibold">{booking.artist_name}</p>
   {booking.status==="cancelled"?<p role="alert">{t.locked}</p>:<>
    <label className="block text-sm">{t.notes}<textarea rows={5} maxLength={5000} value={notes} onChange={event=>setNotes(event.target.value)} className="mt-1 w-full rounded-lg border bg-background p-2"/></label>
    <div className="rounded-lg border p-3 text-sm"><p className="font-semibold">{t.preview}</p><p className="whitespace-pre-wrap break-words text-muted-foreground">{booking.internal_notes??"—"}</p><hr className="my-2"/><p className="whitespace-pre-wrap break-words">{notes||"—"}</p></div>
    <div className="flex flex-wrap gap-2"><button type="button" disabled={busy||notes===(booking.internal_notes??"")} onClick={()=>void save()} className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{t.save}</button><button type="button" disabled={busy} onClick={()=>setBooking(null)} className="rounded-lg border px-3 py-2 text-sm">{t.cancel}</button></div>
   </>}
  </div>}
  {booking&&audit.length>0&&<section className="space-y-2 rounded-xl border p-3"><h3 className="font-semibold">{t.audit}</h3><ol className="space-y-1 text-xs">{audit.map(entry=><li key={entry.id}>{new Date(entry.changed_at).toLocaleString()} · {t.before}: {entry.previous_length} · {t.after}: {entry.new_length}</li>)}</ol></section>}
  {feedback&&<p role="status" className="text-sm">{feedback}</p>}
 </section>
}
