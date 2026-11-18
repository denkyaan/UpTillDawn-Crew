import {useState} from "react"
import {useSession} from "../lib/session"
import {loadTasks,type TaskRow} from "../lib/queries"
import {useRead} from "../lib/use-read"
import {useLocale} from "../lib/use-locale"
import {MIGRATION_WRITES_ENABLED,confirmOwnTask,updateOwnTaskStatus,type TaskStatus} from "../lib/operational-writes"

function OwnTask({task,refresh}:{task:TaskRow;refresh:()=>void}){
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState(false)
 async function mutate(action:()=>Promise<void>){
  if(busy||!MIGRATION_WRITES_ENABLED)return
  setBusy(true);setError(false)
  try{await action();refresh()}catch{setError(true)}finally{setBusy(false)}
 }
 return <li>
  <div className="row"><strong>{task.tasks?.title||"Task"}</strong>
   <span className="muted">{task.status}</span></div>
  {task.tasks?.description&&<p>{task.tasks.description}</p>}
  {MIGRATION_WRITES_ENABLED&&<div className="row">
    {!task.confirmed_at?<button className="primary" disabled={busy} onClick={()=>void mutate(()=>confirmOwnTask(task.id))}>Confirm assignment</button>
    :<label className="muted">Task status
      <select disabled={busy} value={task.status}
       onChange={e=>void mutate(()=>updateOwnTaskStatus(task.id,e.target.value as TaskStatus))}>
       {(["NOT STARTED","IN PROGRESS","COMPLETED"] as const).map(v=><option value={v} key={v}>{v}</option>)}
      </select>
     </label>}
   </div>}
  {error&&<p role="alert" className="error">The server rejected this change. Your task remains unchanged.</p>}
 </li>
}
export default function Tasks(){
 const {identity}=useSession(),{t}=useLocale()
 const result=useRead(identity!.id,"tasks",signal=>loadTasks(identity!.id,signal))
 return <><div className="row"><h1>{t.tasks}</h1><button className="primary" onClick={result.refresh}>{t.refresh}</button></div>
 {result.stale&&<p className="notice" role="status">{t.offline}</p>}
 {result.error&&<p className="error" role="alert">{t.unavailable}</p>}
 {result.loading&&<p role="status">{t.loading}</p>}
 {!result.loading&&result.data?.length===0&&<p>{t.noData}</p>}
 {!MIGRATION_WRITES_ENABLED&&<p className="muted">Task confirmation and status changes are disabled until seven-role acceptance.</p>}
 <ul className="list">{result.data?.map(entry=><OwnTask key={entry.id} task={entry} refresh={result.refresh}/>)}</ul>
 </>
}
