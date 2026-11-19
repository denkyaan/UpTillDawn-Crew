import {useMemo} from "react"
import {useLocale} from "../lib/use-locale"
import {useSession} from "../lib/session"
import {usePrivateQuery} from "../lib/use-private-query"
import {administrationDocuments,administrationPayments,allowedInventory} from "../lib/operational-reads"
import {summarizeAdministration,currentBelgianDate,type AdministrationSnapshot} from "../shared/admin-overview"
import {adminOverviewText} from "../shared/admin-overview-copy"
import {Refresh,WhenLoading} from "./data-ui"

async function loadOverview(signal:AbortSignal):Promise<AdministrationSnapshot>{
 // Exactly three bounded RLS queries, on-demand and never polled.
 const [documents,payments,inventory]=await Promise.all([
  administrationDocuments(signal),administrationPayments(signal),allowedInventory(signal)
 ])
 return {documents,payments,inventory}
}
export default function AdministrationOverview(){
 const uid=useSession().identity!.id
 const {locale}=useLocale(),t=adminOverviewText(locale)
 const overview=usePrivateQuery<AdministrationSnapshot>(uid,"administration-overview",loadOverview)
 const pulse=useMemo(()=>overview.data?
  summarizeAdministration(overview.data,currentBelgianDate(new Date())):null,[overview.data])
 return <section className="card" aria-label={t.heading}>
  <div className="row"><h2>{t.heading}<span className="muted"> · {t.overview}</span></h2>
   <Refresh onClick={overview.refresh}/></div>
  <p className="muted">{t.description}</p>
  <WhenLoading loading={overview.loading} error={overview.error}>
   {pulse&&<>
    <div className="grid">
     <div><strong>{t.documents}</strong><p className="number">{pulse.documents}</p><small>{t.docsCount}</small></div>
     <div><strong>{t.payments}</strong><p className="number">{pulse.payments}</p><small>{t.payCount}</small></div>
     <div><strong>{t.inventory}</strong><p className="number">{pulse.items}</p><small>{t.itemCount}</small></div>
    </div>
    <dl>
     <dt>{t.overdue}</dt><dd>{pulse.overdue}</dd>
     <dt>{t.peppol}</dt><dd>{pulse.peppolIssues}</dd>
     <dt>{t.stock}</dt><dd>{pulse.stockIssues}</dd>
    </dl>
    <h3>{t.highlights}</h3>
    {!pulse.priorities.length?<p>{t.empty}</p>:
     <ul className="list">{pulse.priorities.map((p,i)=><li key={p.kind+":"+p.name+":"+i}>
      <div className="row"><strong>{p.name}</strong><span>{p.status}</span></div>
      <p className="muted">{p.kind==="stock"?t.stockDetail:p.kind==="due"?t.due:t.status}: {p.detail}</p>
     </li>)}</ul>}
   </>}
  </WhenLoading>
  <p className="muted">{t.limited} {t.noPayment}</p>
 </section>
}
