import {useSession} from "../lib/session"
import {loadTasks} from "../lib/queries"
import {useRead} from "../lib/use-read"
import {copy,deviceLocale} from "../shared/i18n"

export default function Tasks(){
 const {identity}=useSession(),t=copy(deviceLocale())
 const result=useRead(identity!.id,"tasks",signal=>loadTasks(identity!.id,signal))
 return <><div className="row"><h1>{t.tasks}</h1><button className="primary" onClick={result.refresh}>{t.refresh}</button></div>
 {result.stale&&<p className="notice" role="status">{t.offline}</p>}
 {result.error&&<p className="error" role="alert">{t.unavailable}</p>}
 {result.loading&&<p role="status">{t.loading}</p>}
 {!result.loading&&result.data?.length===0&&<p>{t.noData}</p>}
 <ul className="list">{result.data?.map(entry=><li key={entry.id}>
  <div className="row"><strong>{entry.tasks?.title||"Task"}</strong><span className="muted">{entry.status}</span></div>
  {entry.tasks?.description&&<p>{entry.tasks.description}</p>}
 </li>)}</ul></>
}
