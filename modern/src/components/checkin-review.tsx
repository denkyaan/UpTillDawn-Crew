import {useState} from "react"
import {useSession} from "../lib/session"
import {usePrivateQuery} from "../lib/use-private-query"
import {pendingReviewCheckins,decideAllowedCheckin,type PendingCheckin} from "../lib/checkin-review"
import {writesAvailable} from "../lib/operational-mutations"
import {useLocale} from "../lib/use-locale"
import {workflowCopy} from "../shared/workflow-copy"
import {DataList,Refresh,Timestamp,WhenLoading} from "./data-ui"

function CheckinRow({row,onDecision}:{row:PendingCheckin;onDecision:()=>void}){
 const uid=useSession().identity!.id
 const {locale}=useLocale(),t=workflowCopy(locale)
 const [reason,setReason]=useState("")
 const [busy,setBusy]=useState(false)
 const [rejecting,setRejecting]=useState(false)
 const [notice,setNotice]=useState("")
 async function decide(approve:boolean){
  if(busy||row.user_id===uid||!writesAvailable())return
  setBusy(true);setNotice("")
  try{await decideAllowedCheckin(row.id,approve,reason);setNotice(t.decisionDone);setRejecting(false);onDecision()}
  catch{setNotice(t.decisionFailed)}
  finally{setBusy(false)}
 }
 return <li><div className="row"><strong>{row.type||"Check-in"} · {row.user_id.slice(0,8)}</strong>
  <span className="muted">{row.reviewer_kind||"responsible"}</span></div>
  <p><Timestamp value={row.requested_at}/></p>
  {row.early_reason&&<p className="muted">{row.early_reason}</p>}
  {writesAvailable()&&row.user_id!==uid&&<div>
   <div className="row"><button type="button" disabled={busy} onClick={()=>void decide(true)}>{t.approve}</button>
    <button type="button" disabled={busy} onClick={()=>setRejecting(v=>!v)}>{t.deny}</button></div>
   {rejecting&&<form onSubmit={e=>{e.preventDefault();void decide(false)}}>
    <label>{t.reason}<textarea required minLength={3} maxLength={500} value={reason}
     onChange={e=>setReason(e.target.value)}/></label>
    <button type="submit" disabled={busy||reason.trim().length<3}>{t.deny}</button>
   </form>}
  </div>}
  {notice&&<p role="status">{notice}</p>}
 </li>
}
export default function CheckinReview({eventId}:{eventId:string|null}){
 const uid=useSession().identity!.id
 const {locale}=useLocale(),t=workflowCopy(locale)
 const r=usePrivateQuery<PendingCheckin[]>(uid,"pending-checkins:"+(eventId||"admin"),
  signal=>pendingReviewCheckins(eventId,signal))
 return <section className="card"><div className="row"><h2>{t.pendingCheckins}</h2><Refresh onClick={r.refresh}/></div>
  <WhenLoading loading={r.loading} error={r.error}>
   <DataList empty={!r.data?.length}>{r.data?.map(row=>
    <CheckinRow key={row.id} row={row} onDecision={r.refresh}/>)}</DataList>
  </WhenLoading>
  {!writesAvailable()&&<p className="muted">{t.readOnly}</p>}
 </section>
}
