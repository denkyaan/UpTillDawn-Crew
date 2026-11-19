import {Suspense,lazy,useState} from "react"
const HistoryPanel=lazy(()=>import("../components/history-panel"))
import {useSession} from "../lib/session"
import {usePrivateQuery} from "../lib/use-private-query"
import {ownShifts,ownCheckIns,ownHours,type Shift,type CheckIn,type WorkSession} from "../lib/operational-reads"
import {confirmOwnShift,writesAvailable} from "../lib/operational-mutations"
import {DataList,Refresh,Timestamp,WhenLoading} from "../components/data-ui"

type View="shifts"|"checkins"|"hours"|"timesheets"|"equipment"
export default function Crew(){
 const {identity}=useSession(),uid=identity!.id
 const [view,setView]=useState<View>("shifts")
 return <><h1>Mijn planning en uren</h1><p className="muted">Lokaal gerenderd. Actuele gegevens rechtstreeks via Supabase en bestaande toegangsregels.</p>
 <nav className="nav" aria-label="Crewoverzicht">
  {([["shifts","Mijn diensten"],["checkins","Check-ins"],["hours","Gewerkte uren"],["timesheets","Timesheets"],["equipment","Materiaal"]] as const)
   .map(([key,title])=><button key={key} type="button" className={view===key?"primary":""} aria-pressed={view===key} onClick={()=>setView(key)}>{title}</button>)}
 </nav>
 <div style={{paddingTop:"1rem"}}>
  {view==="shifts"?<Shifts uid={uid}/>:view==="checkins"?<Checkins uid={uid}/>:view==="hours"?<Hours uid={uid}/>:view==="timesheets"?<Suspense fallback="Timesheets laden…"><HistoryPanel kind="my-timesheets"/><HistoryPanel kind="time-reviews"/></Suspense>:<Suspense fallback="Materiaal laden…"><HistoryPanel kind="issued-items"/><HistoryPanel kind="settlements"/></Suspense>}
 </div></>
}
function Shifts({uid}:{uid:string}){
 const r=usePrivateQuery<Shift[]>(uid,"own-shifts",signal=>ownShifts(uid,signal))
 const [busy,setBusy]=useState<string|null>(null)
 const [error,setError]=useState(false)
 async function confirm(id:string){
  if(!writesAvailable()||busy)return
  setBusy(id);setError(false)
  try{await confirmOwnShift(id);r.refresh()}catch{setError(true)}
  finally{setBusy(null)}
 }
 return <section className="card"><div className="row"><h2>Mijn diensten</h2><div className="row"><Refresh onClick={r.refresh}/>
  <button type="button" disabled={!r.data?.length||r.loading||Boolean(r.error)} onClick={()=>void import("../lib/export-csv").then(m=>m.downloadCsv("mijn-diensten.csv",["Functie","Start","Einde","Status"],(r.data||[]).map(x=>[x.role_name,x.scheduled_start,x.scheduled_end,x.response_status||x.status])))}>CSV exporteren</button></div></div>
  {error&&<p role="alert" className="error">Dienstenbevestiging niet verwerkt.</p>}
  <WhenLoading loading={r.loading} error={r.error}>
   <DataList empty={!r.data?.length}>{r.data?.map(shift=><li key={shift.id}>
    <div className="row"><strong>{shift.role_name||shift.shift_kind||"Dienst"}</strong><span className="muted">{shift.response_status||shift.status}</span></div>
    <p>Van <Timestamp value={shift.scheduled_start}/> tot <Timestamp value={shift.scheduled_end}/></p>
    <p className="muted">Evenement {shift.event_id.slice(0,8)}</p>
    {writesAvailable()&&shift.status!=="cancelled"&&!shift.confirmed_at&&<button className="primary" disabled={busy!==null} onClick={()=>void confirm(shift.id)}>Bevestigen</button>}
   </li>)}</DataList>
  </WhenLoading>
  {!writesAvailable()&&<p className="muted">Shiftbevestigingen zijn tijdelijk alleen-lezen in deze migratiekandidaat.</p>}
 </section>
}
function Checkins({uid}:{uid:string}){
 const r=usePrivateQuery<CheckIn[]>(uid,"own-checkins",signal=>ownCheckIns(uid,signal))
 return <section className="card"><div className="row"><h2>Mijn check-ins</h2><Refresh onClick={r.refresh}/></div>
 <WhenLoading loading={r.loading} error={r.error}><DataList empty={!r.data?.length}>{r.data?.map(item=><li key={item.id}>
  <div className="row"><strong>{item.type||"Aanvraag"}</strong><span className="muted">{item.status}</span></div>
  <p>Aangevraagd <Timestamp value={item.requested_at}/></p>
  {item.decided_at&&<p>Beslist <Timestamp value={item.decided_at}/></p>}
 </li>)}</DataList></WhenLoading>
 <p className="muted">Nieuwe GPS/QR-check-ins vereisen de bestaande verificatieflow en zijn nog niet overgezet.</p></section>
}
function Hours({uid}:{uid:string}){
 const r=usePrivateQuery<WorkSession[]>(uid,"own-work-hours",signal=>ownHours(uid,signal))
 return <section className="card"><div className="row"><h2>Mijn werkregistraties</h2><Refresh onClick={r.refresh}/></div>
 <WhenLoading loading={r.loading} error={r.error}><DataList empty={!r.data?.length}>{r.data?.map(item=><li key={item.id}>
  <div className="row"><strong>Werkregistratie</strong><span className="muted">{item.status}</span></div>
  <p>Start <Timestamp value={item.started_at}/> · Einde <Timestamp value={item.ended_at}/></p>
 </li>)}</DataList></WhenLoading>
 <p className="muted">Geen loon- of overurenberekening uit ruwe registraties: de officiële timesheetgoedkeuring blijft in het bestaande systeem.</p></section>
}
