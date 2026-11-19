import {useSession} from "../lib/session"
import {usePrivateQuery} from "../lib/use-private-query"
import {DataList,Refresh,Timestamp,WhenLoading} from "./data-ui"
import {
 ownTimesheets,ownTimeReviews,allowedSales,allowedInventoryIssues,
 allowedSettlements,allowedMovements,adminTicketImports,adminTicketSales,
 adminContractSignatures,adminTimesheets,type HistoryRow
} from "../lib/extended-reads"

export type HistoryKind=
 "my-timesheets"|"time-reviews"|"sales"|"issued-items"|"settlements"|
 "movements"|"ticket-imports"|"ticket-sales"|"contracts"|"admin-timesheets"
const specs:Record<HistoryKind,{
 label:string,
 load:(uid:string,signal:AbortSignal)=>Promise<HistoryRow[]>,
 exportFile:string
}>={
 "my-timesheets":{label:"Mijn timesheets",load:ownTimesheets,exportFile:"mijn-timesheets.csv"},
 "time-reviews":{label:"Mijn uurcorrectieaanvragen",load:ownTimeReviews,exportFile:"mijn-uurcorrecties.csv"},
 "sales":{label:"Verkooptransacties",load:(_,signal)=>allowedSales(signal),exportFile:"verkooptransacties.csv"},
 "issued-items":{label:"Mijn materiaaluitleen",load:allowedInventoryIssues,exportFile:"mijn-materiaaluitleen.csv"},
 "settlements":{label:"Materiaalteruggaven",load:allowedSettlements,exportFile:"mijn-teruggaven.csv"},
 "movements":{label:"Inventarisbewegingen",load:(_,signal)=>allowedMovements(signal),exportFile:"voorraadbewegingen.csv"},
 "ticket-imports":{label:"Ticketimports",load:(_,signal)=>adminTicketImports(signal),exportFile:"ticketimports.csv"},
 "ticket-sales":{label:"Ticketverkopen",load:(_,signal)=>adminTicketSales(signal),exportFile:"ticketverkopen.csv"},
 "contracts":{label:"Contractondertekeningen",load:(_,signal)=>adminContractSignatures(signal),exportFile:"contractstatussen.csv"},
 "admin-timesheets":{label:"Personeelstimesheets",load:(_,signal)=>adminTimesheets(signal),exportFile:"personeelstimesheets.csv"}
}

export default function HistoryPanel({kind}:{kind:HistoryKind}){
 const uid=useSession().identity!.id
 const config=specs[kind]
 const r=usePrivateQuery<HistoryRow[]>(uid,"history:"+kind,signal=>config.load(uid,signal))
 return <section className="card">
  <div className="row"><h2>{config.label}</h2><div className="row"><Refresh onClick={r.refresh}/>
   <button type="button" disabled={r.loading||Boolean(r.error)||!r.data?.length}
    onClick={()=>void import("../lib/export-csv").then(m=>m.downloadCsv(
     config.exportFile,["Onderwerp","Details","Status","Datum"],
     (r.data||[]).map(item=>[item.title,item.subtitle,item.status,item.when])
    )).catch(()=>{})}>CSV exporteren</button>
  </div></div>
  <WhenLoading loading={r.loading} error={r.error}>
   <DataList empty={!r.data?.length}>{r.data?.map(item=><li key={item.id}>
    <div className="row"><strong>{item.title}</strong><span className="muted">{item.status}</span></div>
    <p>{item.subtitle}</p><p className="muted"><Timestamp value={item.when}/></p>
   </li>)}</DataList>
  </WhenLoading>
  <p className="muted">Actuele RLS-beveiligde gegevens. Export wordt uitsluitend op dit toestel gemaakt. Geen wijzigingen of betalingen uitgevoerd.</p>
 </section>
}
