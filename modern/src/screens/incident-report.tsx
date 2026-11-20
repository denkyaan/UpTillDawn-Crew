import {useRef,useState,type FormEvent} from "react"
import {useSession} from "../lib/session"
import {usePrivateQuery} from "../lib/use-private-query"
import {ownShifts,type Shift} from "../lib/operational-reads"
import {submitOwnIncident,type IncidentInput} from "../lib/transactional-operations"
import {MIGRATION_WRITES_ENABLED} from "../lib/operational-writes"

type Pending={signature:string;operationId:string;position:IncidentInput["position"]}
async function position():Promise<IncidentInput["position"]>{
 if(!navigator.geolocation||!navigator.onLine)return null
 return new Promise(resolve=>navigator.geolocation.getCurrentPosition(
  ({coords})=>resolve({latitude:coords.latitude,longitude:coords.longitude,accuracy:coords.accuracy}),
  ()=>resolve(null),{timeout:6000,maximumAge:0,enableHighAccuracy:true}
 ))
}
export default function IncidentReport({onSubmitted}:{onSubmitted?:()=>void}){
 const uid=useSession().identity!.id
 const shifts=usePrivateQuery<Shift[]>(uid,"incident-assigned-shifts",signal=>ownShifts(uid,signal))
 const events=[...new Set((shifts.data||[]).map(x=>x.event_id))]
 const [eventId,setEventId]=useState("")
 const [workplace,setWorkplace]=useState("")
 const [busy,setBusy]=useState(false)
 const [notice,setNotice]=useState("")
 const submission=useRef<Pending|null>(null)
 const selectedEvent=events.includes(eventId)?eventId:events[0]||""
 const workplaces=[...new Set((shifts.data||[]).filter(x=>x.event_id===selectedEvent&&x.workplace_id).map(x=>x.workplace_id!))]
 const selectedWorkplace=workplaces.includes(workplace)?workplace:""
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault()
  if(!MIGRATION_WRITES_ENABLED||busy||!selectedEvent)return
  const fields=new FormData(e.currentTarget)
  const input={
   eventId:selectedEvent,workplaceId:selectedWorkplace||null,
   message:String(fields.get("message")||"").trim(),
   category:String(fields.get("category")||"general"),
   urgency:String(fields.get("urgency")||"normal"),
   peopleInvolved:String(fields.get("people")||"").trim(),
  }
  const signature=JSON.stringify(input)
  setBusy(true);setNotice("")
  try{
   // Preserve operation UUID AND coordinates across retry on ambiguous network
   // failures. A new payload always gets a new operation UUID.
   const previous=submission.current
   const next:Pending=previous?.signature===signature?previous:{
    signature,operationId:crypto.randomUUID(),position:await position()
   }
   submission.current=next
   await submitOwnIncident({...input,operationId:next.operationId,position:next.position})
   submission.current=null
   setNotice("Incident door de server bevestigd. De verantwoordelijke kan het nu behandelen.")
   onSubmitted?.()
  }catch{
   setNotice(navigator.onLine
    ?"Geen serverbevestiging. Je melding blijft in het formulier; opnieuw proberen gebruikt dezelfde operatiecode."
    :"Offline: melding is nog NIET verzonden. De tekst blijft in dit formulier zolang het open is.")
  }finally{setBusy(false)}
 }
 if(!MIGRATION_WRITES_ENABLED)return <p className="notice">Urgente meldingen worden in de bestaande app verwerkt. Nieuwe incidenten zijn hier nog geblokkeerd.</p>
 return <section className="card" style={{borderColor:"#a74f4f"}}><h2>Urgent incident melden</h2>
  <form onSubmit={e=>void submit(e)}>
   <label>Evenement<select required disabled={shifts.loading||Boolean(shifts.error)}
    value={selectedEvent} onChange={e=>{setEventId(e.target.value);setWorkplace("")}}>
     {events.map(event=><option key={event} value={event}>{event.slice(0,8)}</option>)}
    </select></label>
   <label>Werkplek<select value={selectedWorkplace} onChange={e=>setWorkplace(e.target.value)}>
    <option value="">Geen specifieke werkplek</option>
    {workplaces.map(id=><option key={id} value={id}>{id.slice(0,8)}</option>)}
   </select></label>
   <label>Categorie<select name="category">
    {["general","medical","safety","security","equipment","technical","staff"].map(x=><option key={x} value={x}>{x}</option>)}
   </select></label>
   <label>Urgentie<select name="urgency">
    <option value="normal">Normaal</option><option value="high">Hoog</option><option value="urgent">Urgent</option>
   </select></label>
   <label>Betrokken personen<input name="people" maxLength={2000}/></label>
   <label>Wat is er gebeurd?<textarea name="message" minLength={3} maxLength={4000} required/></label>
   <button className="primary" disabled={busy||shifts.loading||Boolean(shifts.error)||!selectedEvent}>{busy?"Verzenden…":"Incident indienen"}</button>
  </form>
  {notice&&<p role="status">{notice}</p>}
  <p className="muted">Onlineverificatie is vereist. Foto's, video en duurzame offline wachtrij worden pas ingeschakeld na de upload-/malwarescantests. Geen onbevestigde melding wordt als verwerkt gemarkeerd.</p>
 </section>
}
