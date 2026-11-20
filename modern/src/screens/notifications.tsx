import {useState} from "react"
import {Link} from "react-router-dom"
import {useSession} from "../lib/session"
import {usePrivateQuery} from "../lib/use-private-query"
import {ownNotifications,type Notification} from "../lib/operational-reads"
import {safeRoute} from "../shared/identity"
import {useLocale} from "../lib/use-locale"
import {markOwnNotificationRead,markDisplayedNotificationsRead,writesAvailable} from "../lib/operational-mutations"
import {DataList,Refresh,Timestamp,WhenLoading} from "../components/data-ui"

export default function Notifications(){
 const uid=useSession().identity!.id
 const {t}=useLocale()
 const r=usePrivateQuery<Notification[]>(uid,"my-notifications",signal=>ownNotifications(uid,signal))
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState("")
 async function mark(id:string){
  if(!writesAvailable()||busy)return
  setBusy(true);setError("")
  try{await markOwnNotificationRead(id)}
  catch{setError(t.notificationReadError)}
  finally{r.refresh();setBusy(false)}
 }
 async function markVisible(){
  if(!writesAvailable()||busy)return
  const ids=(r.data||[]).filter(item=>!item.read_at).map(item=>item.id)
  if(!ids.length)return
  setBusy(true);setError("")
  try{await markDisplayedNotificationsRead(ids)}
  catch{setError(t.notificationBatchError)}
  finally{r.refresh();setBusy(false)}
 }
 const visibleUnread=(r.data||[]).filter(item=>!item.read_at).length
 return <><div className="row"><h1>{t.notifications}</h1><div className="row"><Refresh onClick={r.refresh}/>
  {writesAvailable()&&<button type="button" disabled={busy||r.loading||Boolean(r.error)||!visibleUnread}
   onClick={()=>void markVisible()}>{t.markDisplayedRead} ({visibleUnread})</button>}
 </div></div>
 {error&&<p role="alert" className="error">{error}</p>}
  <section className="card"><WhenLoading loading={r.loading} error={r.error}>
   <DataList empty={!r.data?.length}>{r.data?.map(item=><li key={item.id}>
    <div className="row"><strong>{item.title}</strong>{!item.read_at&&<span className="muted">{t.newNotification}</span>}</div>
    <p>{item.body}</p><p className="muted"><Timestamp value={item.created_at}/></p>
    <div className="row">{item.link&&safeRoute(item.link)!=="/"&&<Link to={safeRoute(item.link)}>{t.openInApp}</Link>}
    {!item.read_at&&writesAvailable()&&<button type="button" disabled={busy} onClick={()=>void mark(item.id)}>{t.markRead}</button>}</div>
   </li>)}</DataList>
  </WhenLoading></section>
  <p className="muted">{t.notificationMigrationNote}</p>
 </>
}
