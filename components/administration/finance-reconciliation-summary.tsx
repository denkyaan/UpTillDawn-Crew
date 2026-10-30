import type {SupabaseClient} from '@supabase/supabase-js'
import {administrationAccess} from '@/lib/administration/access'
import type {SupportedUiLocale} from '@/lib/locale-preferences'
const copy={nl:{title:'Betalingsafstemming',intro:'Alle goedgekeurde EUR-facturen, met geregistreerde betalingen en goedgekeurde creditnota’s.',unpaid:'Onbetaald',partial:'Gedeeltelijk betaald',settled:'Vereffend',overpaid:'Te veel betaald',error:'Afstemming niet beschikbaar.'},fr:{title:'Rapprochement des paiements',intro:'Toutes les factures EUR approuvées, paiements enregistrés et avoirs approuvés compris.',unpaid:'Impayées',partial:'Partiellement payées',settled:'Soldées',overpaid:'Trop payées',error:'Rapprochement indisponible.'},en:{title:'Payment reconciliation',intro:'All approved EUR invoices, including recorded payments and approved credit notes.',unpaid:'Unpaid',partial:'Partially paid',settled:'Settled',overpaid:'Overpaid',error:'Reconciliation unavailable.'},de:{title:'Zahlungsabgleich',intro:'Alle genehmigten EUR-Rechnungen, einschließlich erfasster Zahlungen und genehmigter Gutschriften.',unpaid:'Unbezahlt',partial:'Teilweise bezahlt',settled:'Ausgeglichen',overpaid:'Überzahlt',error:'Abgleich nicht verfügbar.'}} as const
export default async function FinanceReconciliationSummary({locale}:{locale:SupportedUiLocale}){
 const access=await administrationAccess()
 if(!access.ok)return null
 const t=copy[locale],{data,error}=await (access.db as unknown as SupabaseClient).rpc('upt_administration_finance_summary')
 const valid=data&&['unpaid','partial','settled','overpaid'].every(key=>typeof data[key]==='string'&&/^\d+$/.test(data[key]))
 return <div className="mt-5 rounded-xl border p-4"><h3 className="font-semibold">{t.title}</h3><p className="mt-2 text-sm text-muted-foreground">{t.intro}</p>{error||!valid?<p role="alert" className="mt-2 text-sm">{t.error}</p>:<div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">{(['unpaid','partial','settled','overpaid'] as const).map(key=><div key={key} className="rounded-lg border p-3"><strong className="block text-xl">{data[key]}</strong>{t[key]}</div>)}</div>}</div>
}
