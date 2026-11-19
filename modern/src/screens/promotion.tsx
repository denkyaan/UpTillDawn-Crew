import {useState} from "react"
import {Link} from "react-router-dom"
import {useSession} from "../lib/session"
import {usePrivateQuery} from "../lib/use-private-query"
import {promotionTasks,type PromotionTask} from "../lib/operational-reads"
import {startOwnPromotionTask,writesAvailable} from "../lib/operational-mutations"
import {channelTitle} from "../shared/chat-ui"
import {useLocale} from "../lib/use-locale"
import {DataList,Refresh,WhenLoading} from "../components/data-ui"

export default function Promotion(){
 const uid=useSession().identity!.id
 const {t,locale}=useLocale()
 const r=usePrivateQuery<PromotionTask[]>(uid,"promotion-assigned-tasks",signal=>promotionTasks(uid,signal))
 const [busy,setBusy]=useState<string|null>(null)
 const [error,setError]=useState(false)
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
  </li>)}</DataList>
 </WhenLoading></section>
 <p><Link to="/portals/promotion/chat">{channelTitle("Algemene chat promotie",locale)}</Link></p>
 <p className="muted">{t.promotionEvidencePending}</p>
 </>
}
