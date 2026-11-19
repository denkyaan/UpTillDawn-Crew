import {useState} from "react"
import {useSession} from "../lib/session"
import {usePrivateQuery} from "../lib/use-private-query"
import {responsibleAssignments,responsibleShifts,type ResponsibleAssignment,type Shift} from "../lib/operational-reads"
import {DataList,Refresh,Timestamp,WhenLoading} from "../components/data-ui"
import {lazy,Suspense} from "react"
const CheckinReview=lazy(()=>import("../components/checkin-review"))

export default function Responsible(){
 const session=useSession(),uid=session.identity!.id
 const assignments=usePrivateQuery<ResponsibleAssignment[]>(uid,"responsible-assignments",signal=>responsibleAssignments(uid,signal))
 const [selected,setSelected]=useState("")
 const allowedEvents=[...new Set((assignments.data||[]).map(x=>x.event_id))]
 const eventId=allowedEvents.includes(selected)?selected:allowedEvents[0]||null
 const isAdmin=session.identity?.role==="admin"||session.identity?.is_owner
 return <><div className="row"><h1>Verantwoordelijke · werkpostplanning</h1><Refresh onClick={assignments.refresh}/></div>
 <WhenLoading loading={assignments.loading} error={assignments.error}>
  {eventId&&<><label>Evenement
   <select value={eventId} onChange={e=>setSelected(e.target.value)}>{allowedEvents.map(id=><option value={id} key={id}>{id.slice(0,8)}</option>)}</select>
  </label><ResponsibleCrew key={eventId} uid={uid} eventId={eventId}/>
   <Suspense fallback="Check-ins laden…"><CheckinReview eventId={eventId}/></Suspense></>}
  {!eventId&&<p className="muted">{isAdmin?"Adminplanning bestaat nog in de huidige app.":"Geen actieve werkpostverantwoordelijkheid zichtbaar."}</p>}
  {!eventId&&isAdmin&&<Suspense fallback="Check-ins laden…"><CheckinReview eventId={null}/></Suspense>}
 </WhenLoading>
 <p className="muted">Teamgegevens worden alleen getoond als de bestaande databasebeveiliging hiervoor toegang geeft. Toewijzen, overdragen en goedkeuren blijven in de huidige workflow.</p>
 </>
}
function ResponsibleCrew({uid,eventId}:{uid:string;eventId:string}){
 const r=usePrivateQuery<Shift[]>(uid,"responsible-shifts:"+eventId,signal=>responsibleShifts(eventId,signal))
 return <section className="card"><div className="row"><h2>Diensten per werkpost</h2><Refresh onClick={r.refresh}/></div>
 <WhenLoading loading={r.loading} error={r.error}>
  <DataList empty={!r.data?.length}>{r.data?.map(shift=><li key={shift.id}>
   <div className="row"><strong>{shift.role_name||"Dienst"}</strong><span className="muted">{shift.status} · {shift.response_status||"—"}</span></div>
   <p><Timestamp value={shift.scheduled_start}/> – <Timestamp value={shift.scheduled_end}/></p>
   <p className="muted">Werkplek {shift.workplace_id?.slice(0,8)||"—"} · Personeelsregistratie wordt niet via de client gewijzigd</p>
  </li>)}</DataList>
 </WhenLoading></section>
}
