import {useState} from "react"
import {useSession} from "../lib/session"
import {usePrivateQuery} from "../lib/use-private-query"
import {adminPromotionEvidence,reviewPromotionEvidence,type Evidence} from "../lib/promotion-evidence"
import {validReviewReason,type EvidenceVerdict} from "../shared/approval-validation"
import {writesAvailable} from "../lib/operational-mutations"
import {useLocale} from "../lib/use-locale"
import {workflowCopy} from "../shared/workflow-copy"
import {DataList,Refresh,WhenLoading,Timestamp} from "./data-ui"

function EvidenceRow({item,onSaved}:{item:Evidence;onSaved:()=>void}){
 const {locale}=useLocale(),t=workflowCopy(locale)
 const [reason,setReason]=useState("")
 const [busy,setBusy]=useState(false)
 const [notice,setNotice]=useState("")
 const [editing,setEditing]=useState(false)
 async function review(verdict:EvidenceVerdict){
  if(busy||!writesAvailable())return
  try{validReviewReason(reason)}catch{return}
  setBusy(true);setNotice("")
  try{await reviewPromotionEvidence(item.id,verdict,reason);setNotice(t.reviewConfirmed);setEditing(false);onSaved()}
  catch{setNotice(t.reviewFailed)}
  finally{setBusy(false)}
 }
 return <li><div className="row"><strong>{item.assignment_id.slice(0,8)}</strong>
  <span className="muted">{item.verification_status}</span></div>
  <p className="muted"><Timestamp value={item.submitted_at}/></p>
  {writesAvailable()&&!["verified","rejected"].includes(item.verification_status)&&
   <><button type="button" disabled={busy} onClick={()=>setEditing(v=>!v)}>{t.review}</button>
   {editing&&<div>
    <label>{t.reviewReason}<textarea value={reason} minLength={10} maxLength={1000}
     onChange={e=>setReason(e.target.value)}/></label>
    <div className="row">
     {([["verified",t.verify],["rejected",t.reject],["inconclusive",t.inconclusive]] as const).map(([v,label])=>
      <button key={v} type="button" disabled={busy||reason.trim().length<10} onClick={()=>void review(v)}>{label}</button>)}
    </div>
   </div>}</>}
  {notice&&<p role="status">{notice}</p>}
 </li>
}
export default function PromotionEvidenceReview(){
 const {identity}=useSession(),uid=identity!.id
 const {locale}=useLocale(),t=workflowCopy(locale)
 // Maker-owner and administrative staff are NOT head admins for this RPC.
 if(identity!.role!=="admin")return null
 return <EvidenceReviewInner uid={uid} labels={t}/>
}
function EvidenceReviewInner({uid,labels}:{uid:string;labels:ReturnType<typeof workflowCopy>}){
 const r=usePrivateQuery<Evidence[]>(uid,"admin-promotion-evidence",adminPromotionEvidence)
 return <section className="card"><div className="row"><h2>{labels.adminEvidence}</h2><Refresh onClick={r.refresh}/></div>
  <WhenLoading loading={r.loading} error={r.error}>
   <DataList empty={!r.data?.length}>{r.data?.map(item=>
    <EvidenceRow key={item.id} item={item} onSaved={r.refresh}/>)}</DataList>
  </WhenLoading>
  {!writesAvailable()&&<p className="muted">{labels.readOnly}</p>}
 </section>
}
