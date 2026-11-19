import {useState} from "react"
import {Link} from "react-router-dom"
import {useSession} from "../lib/session"
import {usePrivateQuery} from "../lib/use-private-query"
import {promotionTasks,type PromotionTask} from "../lib/operational-reads"
import {startOwnPromotionTask,writesAvailable} from "../lib/operational-mutations"
import {channelTitle} from "../shared/chat-ui"
import {useLocale} from "../lib/use-locale"
import {DataList,Refresh,WhenLoading,Timestamp} from "../components/data-ui"
import {ownPromotionEvidence,uploadOwnPromotionEvidence,type Evidence} from "../lib/promotion-evidence"
import {workflowCopy} from "../shared/workflow-copy"

export default function Promotion(){
 const uid=useSession().identity!.id
 const {t,locale}=useLocale()
 const labels=workflowCopy(locale)
 const evidence=usePrivateQuery<Evidence[]>(uid,"own-promotion-evidence",signal=>ownPromotionEvidence(uid,signal))
 const r=usePrivateQuery<PromotionTask[]>(uid,"promotion-assigned-tasks",signal=>promotionTasks(uid,signal))
 const [busy,setBusy]=useState<string|null>(null)
 const [error,setError]=useState(false)
 const [fileFor,setFileFor]=useState<string|null>(null)
 const [proofFile,setProofFile]=useState<File|null>(null)
 const [proofNotice,setProofNotice]=useState("")
 async function submitEvidence(id:string){
  const file=proofFile
  if(!file||!writesAvailable()||busy)return
  setBusy(id);setProofNotice("")
  try{await uploadOwnPromotionEvidence(uid,id,file);setProofNotice(labels.proofPending);setFileFor(null);setProofFile(null);evidence.refresh()}
  catch{setProofNotice(labels.proofUncertain);evidence.refresh()}
  finally{setBusy(null)}
 }
 async function start(id:string){
  if(!writesAvailable()||busy)return
  setBusy(id);setError(false)
  try{await startOwnPromotionTask(id)}
  catch{setError(true)}
  finally{r.refresh();setBusy(null)}
 }
 const label=(status:string)=>status==="NOT STARTED"?t.promotionNotStarted:
  status==="IN PROGRESS"?t.promotionInProgress:
  status==="COMPLETED"?t.promotionCompleted:
  status==="CANCELLED"?t.promotionCancelled:status
 return <><div className="row"><h1>{t.promotion} · {t.tasks}</h1><Refresh onClick={r.refresh}/></div>
 <p className="muted">{t.promotionAssignmentsNotice}</p>
 {error&&<p role="alert" className="error">{t.promotionStartFailed}</p>}
 <section className="card"><WhenLoading loading={r.loading} error={r.error}>
  <DataList empty={!r.data?.length}>{r.data?.map(item=><li key={item.id}>
   <div className="row"><strong>{item.title}</strong><span className="muted">{label(item.status)}</span></div>
   <p>{item.description||"—"}</p>
   {item.event_id&&<p className="muted">{t.events}: {item.event_id.slice(0,8)}</p>}
   {writesAvailable()&&(item.status==="NOT STARTED"||(item.status==="IN PROGRESS"&&!item.confirmed_at))&&
    <button type="button" className="primary" disabled={busy!==null}
     onClick={()=>void start(item.id)}>{t.promotionStartTask}</button>}
   {writesAvailable()&&item.status==="IN PROGRESS"&&
    (fileFor===item.id?<form onSubmit={e=>{e.preventDefault();void submitEvidence(item.id)}}>
     <label>{labels.proofFile}<input type="file" accept="image/jpeg,image/png,image/webp"
      required onChange={e=>setProofFile(e.target.files?.[0]||null)}/></label>
     <div className="row"><button type="submit" disabled={busy!==null||!proofFile}>{labels.upload}</button>
      <button type="button" onClick={()=>{setFileFor(null);setProofFile(null)}}>{t.cancelDecline}</button></div>
    </form>:
    <button type="button" disabled={busy!==null} onClick={()=>{setFileFor(item.id);setProofFile(null)}}>{labels.upload}</button>)}
  </li>)}</DataList>
 </WhenLoading></section>
 {proofNotice&&<p role="status">{proofNotice}</p>}
 <section className="card"><div className="row"><h2>{labels.evidence}</h2><Refresh onClick={evidence.refresh}/></div>
  <WhenLoading loading={evidence.loading} error={evidence.error}>
   <DataList empty={!evidence.data?.length}>{evidence.data?.map(row=><li key={row.id}>
    <strong>{row.assignment_id.slice(0,8)}</strong> · {labels.evidenceStatus}: {row.verification_status}
    <p className="muted"><Timestamp value={row.submitted_at}/></p>
   </li>)}</DataList>
  </WhenLoading></section>
 <p><Link to="/portals/promotion/chat">{channelTitle("Algemene chat promotie",locale)}</Link></p>
 <p className="muted">{writesAvailable()?labels.proofPending:t.promotionEvidencePending}</p>
 </>
}
