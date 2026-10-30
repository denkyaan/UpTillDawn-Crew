import {randomUUID} from 'node:crypto'
import type {SupabaseClient} from '@supabase/supabase-js'
import {redirect} from 'next/navigation'
import {revalidatePath} from 'next/cache'
import {administrationAccess} from '@/lib/administration/access'
import type {SupportedUiLocale} from '@/lib/locale-preferences'

const copy={
 nl:{title:'Aankopen ontvangen in de inventaris',intro:'Koppel een goedgekeurde aankoopfactuur aan materiaal van hetzelfde evenement. Alleen Admin kan voorraad bijboeken. De hoeveelheid wordt gecontroleerd en de ontvangst wordt gelogd.',empty:'Geen goedgekeurde aankopen met een evenement gevonden.',item:'Materiaal',quantity:'Ontvangen hoeveelheid',receive:'Ontvangst boeken',error:'Aankoopgegevens konden niet worden geladen.',recent:'Recente goedgekeurde aankopen (max. 100 facturen, 500 regels).',noItems:'Maak eerst materiaal aan voor dit evenement.'},
 fr:{title:'Réceptionner les achats dans le stock',intro:'Associez une facture d’achat approuvée au matériel du même événement. Seul l’Admin peut augmenter le stock. La quantité est vérifiée et la réception est journalisée.',empty:'Aucun achat approuvé associé à un événement.',item:'Matériel',quantity:'Quantité reçue',receive:'Enregistrer la réception',error:'Impossible de charger les achats.',recent:'Achats approuvés récents (100 factures, 500 lignes maximum).',noItems:'Créez d’abord le matériel pour cet événement.'},
 en:{title:'Receive purchases into inventory',intro:'Link an approved purchase invoice to equipment at the same event. Only Admin can add stock. Quantities are checked and receipts are audited.',empty:'No approved purchases linked to an event.',item:'Equipment',quantity:'Quantity received',receive:'Record receipt',error:'Unable to load purchase records.',recent:'Recent approved purchases (up to 100 invoices and 500 lines).',noItems:'Create equipment for this event first.'},
 de:{title:'Einkäufe in den Bestand übernehmen',intro:'Genehmigte Einkaufsrechnungen mit Material derselben Veranstaltung verknüpfen. Nur Admin kann Bestände erhöhen. Mengen werden geprüft und Eingänge protokolliert.',empty:'Keine genehmigten Einkäufe mit Veranstaltung.',item:'Material',quantity:'Empfangene Menge',receive:'Eingang buchen',error:'Einkäufe konnten nicht geladen werden.',recent:'Aktuelle genehmigte Einkäufe (max. 100 Rechnungen und 500 Positionen).',noItems:'Zuerst Material für diese Veranstaltung erstellen.'},
} as const
async function receive(form:FormData){
 'use server'
 const access=await administrationAccess()
 if(!access.ok||!access.user.realIsAdmin)redirect('/portals')
 const line=String(form.get('line')??''),item=String(form.get('item')??''),request=String(form.get('request')??''),quantity=Number(form.get('quantity'))
 if(![line,item,request].every(s=>/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(s))||!Number.isInteger(quantity)||quantity<1||quantity>100000)throw Error('Invalid receipt')
 const {error}=await (access.db as unknown as SupabaseClient).rpc('upt_receive_invoice_inventory',{p_request:request,p_line:line,p_item:item,p_quantity:quantity})
 if(error)throw Error('Receipt rejected: verify invoice approval, event and purchased quantity')
 revalidatePath('/portals/administration/modules/inventory')
}
export default async function InventoryReceipts({locale}:{locale:SupportedUiLocale}){
 const access=await administrationAccess()
 if(!access.ok)return null
 const t=copy[locale],db=access.db as unknown as SupabaseClient
 const invoices=await db.from('admin_financial_documents').select('id,document_number,event_id').eq('kind','purchase_invoice').in('status',['approved','issued','paid']).not('event_id','is',null).order('created_at',{ascending:false}).limit(100)
 const ids=(invoices.data??[]).map(row=>row.id)
 const [lines,items]=ids.length?await Promise.all([db.from('admin_financial_lines').select('id,document_id,description,quantity').in('document_id',ids).order('id').limit(500),db.from('inventory_items').select('id,event_id,name').in('event_id',[...new Set((invoices.data??[]).map(row=>row.event_id))]).eq('is_active',true).order('name').limit(500)]):[{data:[],error:null},{data:[],error:null}]
 return <section className="space-y-3 rounded-2xl border bg-card p-5"><h2 className="text-lg font-semibold">{t.title}</h2><p className="text-sm text-muted-foreground">{t.intro}</p>
  {invoices.error||lines.error||items.error?<p role="alert">{t.error}</p>:!ids.length?<p className="text-sm">{t.empty}</p>:<><p className="text-xs text-muted-foreground">{t.recent}</p>{(invoices.data??[]).map(invoice=><details key={invoice.id} className="rounded-lg border p-3"><summary className="cursor-pointer font-semibold">{invoice.document_number??invoice.id.slice(0,8)}</summary><div className="mt-3 space-y-3">{(lines.data??[]).filter(line=>line.document_id===invoice.id).map(line=>{
   const options=(items.data??[]).filter(item=>item.event_id===invoice.event_id)
   return <div key={line.id} className="rounded-lg border p-3"><p className="text-sm font-medium">{line.description} · {line.quantity}</p>{access.user.realIsAdmin&&(options.length?<form action={receive} className="mt-2 flex flex-wrap items-end gap-3"><input type="hidden" name="request" value={randomUUID()}/><input type="hidden" name="line" value={line.id}/><label className="grid gap-1 text-sm">{t.item}<select required name="item" className="rounded-lg border bg-background p-2">{options.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="grid gap-1 text-sm">{t.quantity}<input required type="number" min={1} max={Math.min(100000,Math.floor(Number(line.quantity)))} defaultValue={1} name="quantity" className="w-28 rounded-lg border bg-background p-2"/></label><button className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white">{t.receive}</button></form>:<p className="mt-2 text-sm text-muted-foreground">{t.noItems}</p>)}</div>
  })}</div></details>)}</>}
 </section>
}
