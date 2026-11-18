import {Link} from "react-router-dom"
import {useSession} from "../lib/session"
import {usePrivateQuery} from "../lib/use-private-query"
import {ownNotifications,type Notification} from "../lib/operational-reads"
import {safeRoute} from "../shared/identity"
import {DataList,Refresh,Timestamp,WhenLoading} from "../components/data-ui"

export default function Notifications(){
 const uid=useSession().identity!.id
 const r=usePrivateQuery<Notification[]>(uid,"my-notifications",signal=>ownNotifications(uid,signal))
 return <><div className="row"><h1>Mijn meldingen</h1><Refresh onClick={r.refresh}/></div>
  <section className="card"><WhenLoading loading={r.loading} error={r.error}>
   <DataList empty={!r.data?.length}>{r.data?.map(item=><li key={item.id}>
    <div className="row"><strong>{item.title}</strong>{!item.read_at&&<span className="muted">Nieuw</span>}</div>
    <p>{item.body}</p><p className="muted"><Timestamp value={item.created_at}/></p>
    {item.link&&safeRoute(item.link)!=="/"&&<Link to={safeRoute(item.link)}>Open in app</Link>}
   </li>)}</DataList>
  </WhenLoading></section>
  <p className="muted">Leesstatus wijzigen en pushmeldingen zijn nog niet volledig gemigreerd.</p>
 </>
}
