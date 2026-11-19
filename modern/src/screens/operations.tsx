import {Suspense,lazy,useState} from "react"
const HistoryPanel=lazy(()=>import("../components/history-panel"))
import {useSession} from "../lib/session"
import {usePrivateQuery} from "../lib/use-private-query"
import {allowedWorkplaces,allowedInventory,ownIncidents,type Workplace,type InventoryItem,type Incident} from "../lib/operational-reads"
import {DataList,Refresh,Timestamp,WhenLoading} from "../components/data-ui"
import {writesAvailable,acknowledgeAllowedIncident} from "../lib/operational-mutations"

type View="workplaces"|"inventory"|"incidents"|"sales"
export default function Operations(){
 const uid=useSession().identity!.id
 const [view,setView]=useState<View>("workplaces")
 return <><h1>Werkplekken, inventaris en incidenten</h1>
  <nav className="nav" aria-label="Operationeel overzicht">
  {([["workplaces","Werkplekken"],["inventory","Inventaris"],["incidents","Mijn incidenten"],["sales","Verkoop"]] as const)
   .map(([key,label])=><button type="button" key={key} className={view===key?"primary":""} aria-pressed={view===key} onClick={()=>setView(key)}>{label}</button>)}
  </nav>
  <div style={{paddingTop:"1rem"}}>{view==="workplaces"?<Workplaces uid={uid}/>:view==="inventory"?<Inventory uid={uid}/>:view==="incidents"?<Incidents uid={uid}/>:<Suspense fallback="Verkoop laden…"><HistoryPanel kind="sales"/></Suspense>}</div>
 </>
}
function Workplaces({uid}:{uid:string}){
 const r=usePrivateQuery<Workplace[]>(uid,"workplaces",allowedWorkplaces)
 return <section className="card"><div className="row"><h2>Werkplekken</h2><Refresh onClick={r.refresh}/></div>
  <WhenLoading loading={r.loading} error={r.error}><DataList empty={!r.data?.length}>
   {r.data?.map(p=><li key={p.id}><div className="row"><strong>{p.name}</strong><span className="muted">Streefbezetting {p.target_staff??"—"}</span></div>
    <p>{p.description||"Geen omschrijving"}</p></li>)}
  </DataList></WhenLoading></section>
}
function Inventory({uid}:{uid:string}){
 const r=usePrivateQuery<InventoryItem[]>(uid,"inventory",allowedInventory)
 return <section className="card"><div className="row"><h2>Beschikbare inventaris</h2><div className="row"><Refresh onClick={r.refresh}/>
  <button type="button" disabled={!r.data?.length||r.loading||Boolean(r.error)} onClick={()=>void import("../lib/export-csv").then(m=>m.downloadCsv("werkplek-inventaris.csv",["Naam","Categorie","Beschikbaar","Totaal","Vermist","Defect"],(r.data||[]).map(x=>[x.name,x.category,x.available_quantity,x.total_quantity,x.missing_quantity,x.damaged_quantity])))}>CSV exporteren</button></div></div>
  <WhenLoading loading={r.loading} error={r.error}><DataList empty={!r.data?.length}>
   {r.data?.map(item=><li key={item.id}><div className="row"><strong>{item.name}</strong><span className="muted">{item.category||"Materiaal"}</span></div>
    <p>Beschikbaar: {item.available_quantity} / {item.total_quantity} · Ontbrekend: {item.missing_quantity} · Defect: {item.damaged_quantity}</p>
   </li>)}
  </DataList></WhenLoading><p className="muted">Uitgifte, tekorten en definitieve inventariscorrecties blijven in de bestaande gecontroleerde workflows.</p><Suspense fallback="Bewegingen laden…"><HistoryPanel kind="movements"/></Suspense></section>
}
function Incidents({uid}:{uid:string}){
 const r=usePrivateQuery<Incident[]>(uid,"my-incidents",signal=>ownIncidents(uid,signal))
 const [busy,setBusy]=useState<string|null>(null)
 const [error,setError]=useState(false)
 async function ack(id:string){
  if(!writesAvailable()||busy)return
  setBusy(id);setError(false)
  try{await acknowledgeAllowedIncident(id);r.refresh()}catch{setError(true)}
  finally{setBusy(null)}
 }
 return <section className="card"><div className="row"><h2>Mijn incidentmeldingen</h2><Refresh onClick={r.refresh}/></div>
 {error&&<p role="alert" className="error">Bevestiging niet verwerkt.</p>}
 <WhenLoading loading={r.loading} error={r.error}><DataList empty={!r.data?.length}>
  {r.data?.map(item=><li key={item.id}>
   <div className="row"><strong>{item.urgency||"Incident"}</strong><span className="muted">{item.status}</span></div>
   <p>{item.description||item.message||"—"}</p><p className="muted"><Timestamp value={item.created_at}/></p>
   {writesAvailable()&&item.status==="open"&&<button className="primary" disabled={busy!==null} onClick={()=>void ack(item.id)}>Bevestig ontvangst (verantwoordelijke)</button>}
  </li>)}
 </DataList></WhenLoading>
 <p className="muted">Meldingen aanmaken en media uploaden blijven in de bestaande app totdat verificatie en offline replay gemigreerd zijn.</p>
 </section>
}
