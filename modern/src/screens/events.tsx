import {useEffect,useState,type FormEvent} from "react"
import {useSession} from "../lib/session"
import {loadEvents,type EventRow} from "../lib/queries"
import {useRead} from "../lib/use-read"
import {useLocale} from "../lib/use-locale"
import {supabase} from "../lib/supabase"
import {setOwnEventAvailability,type AvailabilityResponse} from "../lib/availability"

type Availability={event_id:string;response:AvailabilityResponse;setup_available:boolean|null;breakdown_available:boolean|null}
function date(value:string){const n=Date.parse(value);return Number.isFinite(n)?new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeStyle:"short"}).format(new Date(n)):value}

function AvailabilityForm({event,previous,refresh}:{event:EventRow;previous:Availability|undefined;refresh:()=>Promise<void>}){
 const [saving,setSaving]=useState(false)
 const [error,setError]=useState(false)
 const {locale}=useLocale()
 const cutoff=Date.parse(event.registration_deadline||event.start_at)
 const now=Date.now(),end=Date.parse(event.end_at)
 const canJoin=now<cutoff
 const canCancel=previous?.response==="can"&&now<end
 const allowWrites=import.meta.env.VITE_MIGRATION_ALLOW_WRITES==="true"
 if(!allowWrites)return <p className="muted">Availability writes remain disabled until verified against the existing seven-role workflows.</p>
 if(!canJoin&&!canCancel)return <p className="muted">Registration deadline passed.</p>
 const submit=async(eventForm:FormEvent<HTMLFormElement>)=>{
  eventForm.preventDefault()
  const fd=new FormData(eventForm.currentTarget)
  const response=fd.get("response")==="cannot"?"cannot":"can"
  if(!canJoin&&response!=="cannot")return
  setSaving(true);setError(false)
  try{
   await setOwnEventAvailability({
    eventId:event.id,response,
    setup:fd.get("setup")==="on",breakdown:fd.get("breakdown")==="on",
    reason:String(fd.get("reason")||""),
   })
   await refresh()
  }catch{setError(true)}
  finally{setSaving(false)}
 }
 return <form onSubmit={e=>void submit(e)}>
  <label>Availability
   <select name="response" defaultValue={canJoin?(previous?.response||"can"):"cannot"} disabled={!canJoin}>
    {canJoin&&<option value="can">{locale==="nl"?"Ik kan":"I can attend"}</option>}
    <option value="cannot">{locale==="nl"?"Ik kan niet":"I cannot attend"}</option>
   </select>
  </label>
  <label><input type="checkbox" name="setup" defaultChecked={previous?.setup_available===true}/>Setup available</label>
  <label><input type="checkbox" name="breakdown" defaultChecked={previous?.breakdown_available===true}/>Breakdown available</label>
  <label>Cancellation reason (required when withdrawing)<input type="text" name="reason" minLength={3} maxLength={1000} placeholder="Reason when cancelling"/></label>
  {error&&<p role="alert" className="error">Availability could not be saved.</p>}
  <button disabled={saving} className="primary">{saving?"Saving…":"Save availability"}</button>
 </form>
}
function EventCard({event,previous,refresh,availabilityVerified}:{event:EventRow;previous:Availability|undefined;refresh:()=>Promise<void>;availabilityVerified:boolean}){
 return <article className="card">
  <div className="row"><h2>{event.name}</h2><span className="muted">{event.status}</span></div>
  <p>{date(event.start_at)} – {date(event.end_at)}</p>
  <p className="muted">{[event.venue,event.address].filter(Boolean).join(" · ")}</p>
  <p className="muted">Registration deadline: {date(event.registration_deadline||event.start_at)}</p>
  {event.max_joiners!==null&&<p className="muted">Maximum confirmed: {event.max_joiners}</p>}
  {previous&&<p>Current response: <strong>{previous.response}</strong></p>}
  {availabilityVerified?<AvailabilityForm event={event} previous={previous} refresh={refresh}/>:<p className="muted" role="status">Availability status unavailable — editing disabled.</p>}
 </article>
}
export default function Events(){
 const {identity}=useSession(),{t}=useLocale()
 const result=useRead(identity!.id,"events",loadEvents)
 const [availability,setAvailability]=useState<Availability[]|null>(null)
 const [availabilityError,setAvailabilityError]=useState(false)
 const [retry,setRetry]=useState(0)
 useEffect(()=>{
  let active=true
  const controller=new AbortController()
  const timer=setTimeout(()=>controller.abort(),12000)
  setAvailabilityError(false);setAvailability(null)
  void Promise.resolve(supabase().from("event_availability")
   .select("event_id,response,setup_available,breakdown_available")
   .eq("user_id",identity!.id).limit(100).abortSignal(controller.signal))
   .then(({data,error})=>{
    if(!active)return
    if(error){setAvailabilityError(true);return}
    setAvailability((data||[]) as Availability[])
   }).catch(()=>{if(active)setAvailabilityError(true)}).finally(()=>clearTimeout(timer))
  return()=>{active=false;clearTimeout(timer);controller.abort()}
 },[identity?.id,retry])
 const refresh=async()=>{setRetry(n=>n+1);result.refresh()}
 const known=new Map((availability||[]).map(x=>[x.event_id,x]))
 return <><div className="row"><h1>{t.events}</h1><button className="primary" onClick={()=>void refresh()}>{t.refresh}</button></div>
 {result.stale&&<p className="notice" role="status">{t.offline}</p>}
 {result.error&&<p className="error" role="alert">{t.unavailable}</p>}
 {result.loading&&<p role="status">{t.loading}</p>}
 {availabilityError&&<p className="error" role="alert">Current availability is temporarily unavailable. Writes are blocked.</p>}
 {!result.loading&&result.data?.length===0&&<p>{t.noData}</p>}
 {result.data?.map(event=><EventCard key={event.id} event={event} previous={known.get(event.id)} refresh={refresh} availabilityVerified={availability!==null&&!availabilityError}/>)}
 </>
}
