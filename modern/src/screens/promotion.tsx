import {Link} from "react-router-dom"
import {useSession} from "../lib/session"
import {usePrivateQuery} from "../lib/use-private-query"
import {promotionTasks,type PromotionTask} from "../lib/operational-reads"
import {DataList,Refresh,WhenLoading} from "../components/data-ui"

export default function Promotion(){
 const uid=useSession().identity!.id
 const r=usePrivateQuery<PromotionTask[]>(uid,"promotion-tasks",promotionTasks)
 return <><div className="row"><h1>Promotie · taken</h1><Refresh onClick={r.refresh}/></div>
 <section className="card"><WhenLoading loading={r.loading} error={r.error}>
  <DataList empty={!r.data?.length}>{r.data?.map(item=><li key={item.id}>
   <div className="row"><strong>{item.title}</strong><span className="muted">{item.status}</span></div>
   <p>{item.description||"—"}</p>
  </li>)}</DataList>
 </WhenLoading></section>
 <p><Link to="/portals/promotion/chat">Algemene chat promotie</Link></p>
 <p className="muted">Promotiebewijs uploaden, taakacceptatie en strikes blijven in de bestaande gecontroleerde app.</p>
 </>
}
