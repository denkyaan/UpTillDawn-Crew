import {useMemo,useState} from "react"
import {protectedCandidateGet} from "../lib/owner-api"
import {useLocale} from "../lib/use-locale"
import {makerCopy} from "../shared/maker-copy"
import {checkedDiagnostics,makerPulse,visibleMakerErrors,type MakerItem,type Diagnostics} from "../shared/maker-triage"

function Section({title,rows,empty,actionLabel,reportsLabel}:{title:string;rows:MakerItem[];
 empty:string;actionLabel:string;reportsLabel:string}){
 return <section className="card"><h2>{title}</h2>
  {rows.length===0?<p className="muted">{empty}</p>:
   <ul className="list">{rows.map((item,index)=><li key={(item.at||"")+":"+(item.name||item.action||item.type||"")+":"+index}>
    <div className="row"><strong>{item.name||item.action||item.type||"—"}</strong>
     <span className="muted">{item.status||item.severity||"—"}</span></div>
    {item.route&&<p className="muted">{item.route}</p>}
    {item.needsMaker&&<p role="status"><strong>{actionLabel}</strong></p>}
    {item.count!==null&&item.count!==undefined&&<p>{reportsLabel}: {item.count}</p>}
    <p className="muted">{item.at?new Date(item.at).toLocaleString(): "—"}</p>
   </li>)}</ul>}
 </section>
}
export default function MakerDiagnostics(){
 const {locale}=useLocale(),t=makerCopy(locale)
 const [result,setResult]=useState<Diagnostics|null>(null)
 const [loading,setLoading]=useState(false)
 const [error,setError]=useState("")
 const [onlyAction,setOnlyAction]=useState(false)
 const [query,setQuery]=useState("")
 const pulse=useMemo(()=>result?makerPulse(result):null,[result])
 const visible=useMemo(()=>result?visibleMakerErrors(result.errors,{onlyAction,search:query}):[],
  [result,onlyAction,query])
 const load=async()=>{
  if(loading)return
  setLoading(true);setResult(null);setError("")
  try{
   // A verified, ephemeral Maker session is required at the Worker on every
   // explicit refresh; no background polling or cross-environment token reuse.
   const value=await protectedCandidateGet<Diagnostics>("/api/v1/god/diagnostics")
   setResult(checkedDiagnostics(value))
  }catch{setError(t.error)}
  finally{setLoading(false)}
 }
 async function exportSanitized(){
  if(!result||!visible.length)return
  const m=await import("../lib/export-csv")
  m.downloadCsv("maker-errors-sanitized.csv",
   ["Fout","Route","Status","Ernst","Maker actie","Aantal","Datum"],
   visible.map(x=>[x.name||"",x.route||"",x.status||"",x.severity||"",
    x.needsMaker?"yes":"no",x.count??"",x.at||""]))
 }
 return <><h1>{t.heading}</h1>
  <p>{t.details}</p>
  <p className="muted">{t.environment}</p>
  <button type="button" disabled={loading} className="primary" onClick={()=>void load()}>
   {loading?t.busy:t.refresh}</button>
  {error&&<p role="alert" className="error">{error}</p>}
  {result&&<>
   {pulse&&<section className="card" aria-label={t.needsMaker}>
    <div className="grid">
     <div><strong>{t.needsMaker}</strong><p className="number">{pulse.needsMaker}</p></div>
     <div><strong>{t.critical}</strong><p className="number">{pulse.critical}</p></div>
     <div><strong>{t.recoveryFailed}</strong><p className="number">{pulse.failedRecovery}</p></div>
     <div><strong>{t.allErrors}</strong><p className="number">{pulse.errors}</p></div>
    </div>
    <p className="muted">{t.details}</p>
   </section>}
   <div className="card">
    <div className="row">
     <label><input type="checkbox" checked={onlyAction}
      onChange={e=>setOnlyAction(e.target.checked)}/>{t.onlyAction}</label>
     <button type="button" disabled={!visible.length}
      onClick={()=>void exportSanitized().catch(()=>setError(t.error))}>{t.export}</button>
    </div>
    <label>{t.search}<input type="search" value={query} maxLength={100}
     onChange={e=>setQuery(e.target.value)}/></label>
   </div>
   <Section title={t.errors} rows={visible} empty={t.noMatches}
    actionLabel={t.needsMaker} reportsLabel={t.reports}/>
   <Section title={t.recovery} rows={result.recovery} empty={t.empty}
    actionLabel={t.needsMaker} reportsLabel={t.reports}/>
   <Section title={t.audit} rows={result.audit} empty={t.empty}
    actionLabel={t.needsMaker} reportsLabel={t.reports}/>
  </>}
  <p className="muted">{t.privacy} Geen autonoom herstel in deze kandidaat.</p>
 </>
}
