import type {SupabaseClient} from '@supabase/supabase-js'
import {administrationAccess} from '@/lib/administration/access'
import type {SupportedUiLocale} from '@/lib/locale-preferences'

const copy={nl:{title:'Opgeslagen ticketverkoop',empty:'Nog geen verkopen geïmporteerd.',error:'Verkoopoverzicht niet beschikbaar.',tickets:'Tickets',revenue:'Bruto omzet'},fr:{title:'Ventes de billets enregistrées',empty:'Aucune vente importée.',error:'Récapitulatif des ventes indisponible.',tickets:'Billets',revenue:'Recettes brutes'},en:{title:'Saved ticket sales',empty:'No sales imported yet.',error:'Sales overview unavailable.',tickets:'Tickets',revenue:'Gross revenue'},de:{title:'Gespeicherte Ticketverkäufe',empty:'Noch keine Verkäufe importiert.',error:'Verkaufsübersicht nicht verfügbar.',tickets:'Tickets',revenue:'Bruttoumsatz'}} as const
type Summary={event_id:string;source:string;sale_rows:string;quantity:string;gross_cents:string}
export default async function TicketSalesOverview({locale,events}:{locale:SupportedUiLocale;events:{id:string;name:string}[]}){
 const access=await administrationAccess()
 if(!access.ok)return null
 const t=copy[locale],{data,error}=await (access.db as unknown as SupabaseClient).rpc('upt_ticket_sales_summary')
 const rows=Array.isArray(data)?data as Summary[]:[]
 const valid=rows.every(r=>[r.quantity,r.gross_cents,r.sale_rows].every(value=>typeof value==='string'&&/^\d+$/.test(value)))
 const money=(cents:string)=>{const n=BigInt(cents);return new Intl.NumberFormat(locale).format(n/BigInt(100))+(['nl','fr','de'].includes(locale)?',':'.')+String(n%BigInt(100)).padStart(2,'0')+' EUR'}
 return <section className="space-y-3 rounded-2xl border bg-card p-5"><h2 className="text-lg font-semibold">{t.title}</h2>{error||!valid?<p role="alert">{t.error}</p>:!rows.length?<p className="text-sm">{t.empty}</p>:<ul className="divide-y">{rows.map(row=><li key={row.event_id+':'+row.source} className="flex flex-wrap justify-between gap-3 py-3 text-sm"><span>{events.find(e=>e.id===row.event_id)?.name??row.event_id} · {row.source}</span><span>{t.tickets}: {row.quantity} · {t.revenue}: {money(row.gross_cents)}</span></li>)}</ul>}</section>
}
