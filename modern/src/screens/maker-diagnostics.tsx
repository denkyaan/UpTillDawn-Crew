import {useState} from "react"
import {protectedCandidateGet} from "../lib/owner-api"
type Item={action?:string|null;entityType?:string|null;at?:string|null;type?:string|null;status?:string|null;name?:string|null;route?:string|null;severity?:string|null;needsMaker?:boolean;count?:number|null}
type Diagnostics={audit:Item[];recovery:Item[];errors:Item[]}
function Section({title,rows}:{title:string;rows:Item[]}){
 return <section className="card"><h2>{title}</h2>
  {rows.length===0?<p className="muted">Geen meldingen in dit beperkte overzicht.</p>:
  <ul className="list">{rows.map((item,index)=><li key={index}>
   <div className="row"><strong>{item.name||item.action||item.type||"Melding"}</strong><span>{item.status||item.severity||"—"}</span></div>
   {item.route&&<p className="muted">{item.route}</p>}
   {item.needsMaker&&<p>Actie door maker nodig</p>}
   {item.count!==null&&item.count!==undefined&&<p>Rapportages: {item.count}</p>}
   <p className="muted">{item.at||"Tijd onbekend"}</p>
  </li>)}</ul>}
 </section>
}
export default function MakerDiagnostics(){
 const [result,setResult]=useState<Diagnostics|null>(null)
 const [loading,setLoading]=useState(false)
 const [error,setError]=useState("")
 const load=async()=>{
  if(loading)return
  setLoading(true);setResult(null);setError("")
  try{setResult(await protectedCandidateGet<Diagnostics>("/api/v1/god/diagnostics"))}
  catch{setError("Maker-diagnostiek niet beschikbaar. Dit betekent niet dat er geen fouten zijn.")}
  finally{setLoading(false)}
 }
 return <><h1>God Mode · makerdiagnostiek (migratiekandidaat)</h1>
 <p>Leesoverzicht van maximaal 20 recente auditacties, herstelcontroles en foutmeldingen. De huidige God Mode blijft noodzakelijk om code, omgevingen en instellingen te beheren.</p>
 <button disabled={loading} className="primary" onClick={()=>void load()}>{loading?"Veilig ophalen…":"Haal makerdiagnostiek op"}</button>
 {error&&<p role="alert" className="error">{error}</p>}
 {result&&<><Section title="Fouten" rows={result.errors||[]}/><Section title="Herstelcontroles" rows={result.recovery||[]}/><Section title="Audit" rows={result.audit||[]}/></>}
 <p className="muted">Gegevens worden uitsluitend op aanvraag opgehaald. Privileges, tokens en onbewerkte stacktraces worden niet aan de browser doorgegeven. Geen autonoom herstel, SQL-editor of productiebeheer in de kandidaat.</p>
 </>
}
