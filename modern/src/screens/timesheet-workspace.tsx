import {useState} from "react"
import {useSession} from "../lib/session"
import {usePrivateQuery} from "../lib/use-private-query"
import {loadOwnTimesheets,loadReviewerTimesheets,type Timesheet} from "../lib/timesheet-queries"
import {ownShifts,type Shift} from "../lib/operational-reads"
import {submitOwnTimesheet,reviewAllowedTimesheet,lockApprovedTimesheet} from "../lib/transactional-operations"
import {MIGRATION_WRITES_ENABLED} from "../lib/operational-writes"
import {DataList,Refresh,Timestamp,WhenLoading} from "../components/data-ui"

function Own(){
 const uid=useSession().identity!.id
 const sheets=usePrivateQuery<Timesheet[]>(uid,"own-timesheet-workspace",signal=>loadOwnTimesheets(uid,signal))
 const shifts=usePrivateQuery<Shift[]>(uid,"timesheet-events",signal=>ownShifts(uid,signal))
 const [eventId,setEventId]=useState("")
 const [busy,setBusy]=useState(false)
 const [notice,setNotice]=useState("")
 const options=[...new Set((shifts.data||[]).map(shift=>shift.event_id))]
 const selected=options.includes(eventId)?eventId:options[0]||""
 const submit=async()=>{
  if(!MIGRATION_WRITES_ENABLED||!selected||busy)return
  setBusy(true);setNotice("")
  try{await submitOwnTimesheet(selected);setNotice("Server confirmed submission");sheets.refresh()}
  catch{setNotice("Timesheet not submitted — no change confirmed")}
  finally{setBusy(false)}
 }
 return <section className="card"><div className="row"><h2>Mijn uren indienen</h2><Refresh onClick={sheets.refresh}/></div>
 {MIGRATION_WRITES_ENABLED&&<div className="row">
  <label>Evenement<select value={selected} onChange={e=>setEventId(e.target.value)}>
   {options.map(id=><option key={id} value={id}>{id.slice(0,8)}</option>)}
  </select></label>
  <button className="primary" disabled={busy||!selected||shifts.loading||Boolean(shifts.error)}
   onClick={()=>void submit()}>Timesheet indienen</button>
 </div>}
 {notice&&<p role="status">{notice}</p>}
 <WhenLoading loading={sheets.loading} error={sheets.error}>
  <DataList empty={!sheets.data?.length}>{sheets.data?.map(t=><li key={t.id}>
   <div className="row"><strong>Evenement {t.event_id.slice(0,8)}</strong><span className="muted">{t.status}</span></div>
   <p>Ingediend: <Timestamp value={t.submitted_at}/> · Beoordeeld: <Timestamp value={t.reviewed_at}/></p>
   {t.rejection_reason&&<p className="error">Reden: {t.rejection_reason}</p>}
  </li>)}</DataList>
 </WhenLoading>
 <p className="muted">Geen lokale loonberekening of automatische goedkeuring. Alleen serverbevestigde uren zijn definitief.</p>
 </section>
}
function ReviewRow({sheet,refresh}:{sheet:Timesheet;refresh:()=>void}){
 const uid=useSession().identity!.id
 const [reason,setReason]=useState("")
 const [busy,setBusy]=useState(false)
 const [notice,setNotice]=useState("")
 const [decision,setDecision]=useState<"approve"|"reject"|null>(null)
 async function apply(action:"approve"|"reject"|"lock"){
  if(busy||!MIGRATION_WRITES_ENABLED||sheet.user_id===uid)return
  setBusy(true);setNotice("")
  try{
   if(action==="lock")await lockApprovedTimesheet(sheet.id)
   else await reviewAllowedTimesheet(sheet.id,action==="approve",reason)
   setNotice("Server verified");refresh();setDecision(null)
  }catch{setNotice("Niet verwerkt. De bestaande status is behouden.")}
  finally{setBusy(false)}
 }
 return <li>
  <div className="row"><strong>Event {sheet.event_id.slice(0,8)} · {sheet.user_id.slice(0,8)}</strong><span className="muted">{sheet.status}</span></div>
  <p className="muted">Ingediend: <Timestamp value={sheet.submitted_at}/></p>
  {sheet.rejection_reason&&<p>Reden: {sheet.rejection_reason}</p>}
  {MIGRATION_WRITES_ENABLED&&sheet.user_id!==uid&&<div>
   {sheet.status==="submitted"&&<div className="row">
    <button disabled={busy} onClick={()=>setDecision("approve")}>Goedkeuren</button>
    <button disabled={busy} onClick={()=>setDecision("reject")}>Afwijzen</button>
   </div>}
   {decision==="approve"&&<div><p>Definitief goedkeuren? De server controleert de rechten.</p>
    <button className="primary" disabled={busy} onClick={()=>void apply("approve")}>Bevestig goedkeuring</button></div>}
   {decision==="reject"&&<div><label>Reden van afwijzing
    <input value={reason} maxLength={1000} onChange={e=>setReason(e.target.value)}/></label>
    <button className="primary" disabled={busy||reason.trim().length<3} onClick={()=>void apply("reject")}>Bevestig afwijzing</button></div>}
   {sheet.status==="approved"&&<button className="primary" disabled={busy} onClick={()=>void apply("lock")}>Vergrendelen (uitsluitend admin)</button>}
  </div>}
  {notice&&<p role="status">{notice}</p>}
 </li>
}
function Review(){
 const s=useSession(),uid=s.identity!.id
 const review=usePrivateQuery<Timesheet[]>(uid,"review-timesheets",loadReviewerTimesheets)
 const rows=(review.data||[]).filter(t=>t.user_id!==uid)
 return <section className="card"><div className="row"><h2>Controle en goedkeuring</h2><Refresh onClick={review.refresh}/></div>
  <WhenLoading loading={review.loading} error={review.error}>
   <DataList empty={!rows.length}>{rows.map(row=><ReviewRow key={row.id} sheet={row} refresh={review.refresh}/>)}</DataList>
  </WhenLoading>
  <p className="muted">Geen eigen uren goedkeuren. Definitieve beslissing uitsluitend met actuele database-autorisatie.</p>
 </section>
}
export default function TimesheetWorkspace({review=false}:{review?:boolean}){
 const s=useSession()
 const authorized=Boolean(s.identity&&(s.identity.is_owner||s.identity.role==="admin"||s.identity.role==="responsible_lead"))
 return <>{review?(authorized?<Review/>:null):<Own/>}</>
}
