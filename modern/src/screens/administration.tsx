import {Link} from "react-router-dom"
import {Suspense,lazy,useState} from "react"
const HistoryPanel=lazy(()=>import("../components/history-panel"))
const TimesheetWorkspace=lazy(()=>import("./timesheet-workspace"))
const IntegrationStatus=lazy(()=>import("../components/integration-status"))
const PromotionEvidenceReview=lazy(()=>import("../components/promotion-evidence-review"))
import {useSession} from "../lib/session"
import {usePrivateQuery} from "../lib/use-private-query"
import {administrationDocuments,administrationPayments,allowedInventory,type FinancialDocument,type FinancialPayment,type InventoryItem} from "../lib/operational-reads"
import {DataList,LocalMoney,Refresh,WhenLoading,Timestamp} from "../components/data-ui"

type Section="documents"|"payments"|"inventory"|"ticketing"|"contracts"|"timesheets"
export default function Administration(){
 const uid=useSession().identity!.id
 const [section,setSection]=useState<Section>("documents")
 return <><h1>Administratie · read-only migratieoverzicht</h1>
  <p className="muted">Financiële goedkeuring, contracten, bankkoppelingen, Peppol en verwijderingen blijven beveiligd in de bestaande app.</p>
  <nav className="nav" aria-label="Administratie">
   {([["documents","Documenten"],["payments","Betalingen"],["inventory","Inventaris"],["ticketing","Ticketing"],["contracts","Contracten"],["timesheets","Timesheets"]] as const).map(([key,title])=>
    <button key={key} type="button" className={section===key?"primary":""} aria-pressed={section===key} onClick={()=>setSection(key)}>{title}</button>)}
  </nav>
  <div style={{paddingTop:"1rem"}}>
   {section==="documents"?<><Documents uid={uid}/><Suspense fallback="Koppelingen laden…"><IntegrationStatus area="invoices"/></Suspense></>:section==="payments"?<><Payments uid={uid}/><Suspense fallback="Koppelingen laden…"><IntegrationStatus area="banking"/></Suspense></>:section==="inventory"?<Inventory uid={uid}/>:<Suspense fallback="Gegevens laden…">{section==="ticketing"?<><HistoryPanel kind="ticket-imports"/><HistoryPanel kind="ticket-sales"/><IntegrationStatus area="ticketing"/></>:section==="contracts"?<><HistoryPanel kind="contracts"/><IntegrationStatus area="contracts"/></>:<><TimesheetWorkspace review/><PromotionEvidenceReview/></>}</Suspense>}
  </div>
  <p><Link to="/portals/administration/finance">Financiële totalen bekijken</Link></p>
 </>
}
function Documents({uid}:{uid:string}){
 const r=usePrivateQuery<FinancialDocument[]>(uid,"admin-documents",administrationDocuments)
 return <section className="card"><div className="row"><h2>Financiële documenten</h2><div className="row"><Refresh onClick={r.refresh}/>
 <button type="button" disabled={!r.data?.length||r.loading||Boolean(r.error)} onClick={()=>void import("../lib/export-csv").then(m=>m.downloadCsv("administratie-documenten.csv",["Nummer","Type","Datum","Vervaldag","Valuta","Bruto","Status","Peppol"],(r.data||[]).map(x=>[x.document_number,x.kind,x.issue_date,x.due_date,x.currency,x.gross_amount,x.status,x.peppol_status])))}>CSV exporteren</button></div></div>
 <WhenLoading loading={r.loading} error={r.error}><DataList empty={!r.data?.length}>
 {r.data?.map(item=><li key={item.id}>
  <div className="row"><strong>{item.document_number||item.kind}</strong><span className="muted">{item.status}</span></div>
  <p>{item.kind} · <LocalMoney amount={item.gross_amount} currency={item.currency}/></p>
  <p className="muted">Uitgiftedatum {item.issue_date||"—"} · Vervaldatum {item.due_date||"—"} · Peppol {item.peppol_status||"—"}</p>
 </li>)}
 </DataList></WhenLoading></section>
}
function Payments({uid}:{uid:string}){
 const r=usePrivateQuery<FinancialPayment[]>(uid,"admin-payments",administrationPayments)
 return <section className="card"><div className="row"><h2>Geregistreerde betalingen</h2><Refresh onClick={r.refresh}/></div>
 <WhenLoading loading={r.loading} error={r.error}><DataList empty={!r.data?.length}>
 {r.data?.map(item=><li key={item.id}>
  <div className="row"><strong>{new Intl.NumberFormat("nl-BE",{style:"currency",currency:"EUR"}).format(item.amount)}</strong><span className="muted">{item.paid_on}</span></div>
  <p className="muted">Document {item.document_id.slice(0,8)} · Geregistreerd <Timestamp value={item.created_at}/></p>
 </li>)}
 </DataList></WhenLoading>
 <p className="muted">Deze lijst verstuurt geen betalingen en bewijst geen bankafstemming.</p></section>
}
function Inventory({uid}:{uid:string}){
 const r=usePrivateQuery<InventoryItem[]>(uid,"admin-inventory",allowedInventory)
 return <section className="card"><div className="row"><h2>Inventarisoverzicht</h2><Refresh onClick={r.refresh}/></div>
 <WhenLoading loading={r.loading} error={r.error}><DataList empty={!r.data?.length}>
 {r.data?.map(item=><li key={item.id}><div className="row"><strong>{item.name}</strong><span className="muted">{item.category||"—"}</span></div>
  <p>{item.available_quantity} beschikbaar · {item.missing_quantity} vermist · {item.damaged_quantity} defect</p>
 </li>)}
 </DataList></WhenLoading></section>
}
