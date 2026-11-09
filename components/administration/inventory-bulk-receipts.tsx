import {randomUUID} from 'node:crypto'
import type {SupabaseClient} from '@supabase/supabase-js'
import {administrationAccess} from '@/lib/administration/access'
import {proposeExactInventoryReceipts} from '@/lib/administration/inventory-receipt-matching'
import {InventoryBulkReceiptForm} from '@/components/administration/inventory-bulk-receipt-form'
import type {SupportedUiLocale} from '@/lib/locale-preferences'

const copy={
 nl:{heading:'Bulkontvangst van aankoopfacturen',intro:'Stel voor om meerdere goedgekeurde aankoopregels met identieke materiaalnamen in één transactie te ontvangen. Alleen Admin kan bevestigen.',none:'Geen veilige, exacte materiaalovereenkomsten. Gebruik de individuele ontvangst onderaan.',unavailable:'Ontvangsthistoriek of inventaris is niet volledig beschikbaar. Bulkverwerking is uitgeschakeld.',limit:'Er zijn meer dan 50 voorstellen. De eerste 50 kunnen apart worden ontvangen.',from:'Factuur',count:'Voorgestelde regels'},
 fr:{heading:'Réception groupée des achats',intro:'Proposez la réception de plusieurs lignes approuvées dont les noms correspondent exactement aux articles. Seul Admin peut confirmer.',none:'Aucune correspondance exacte. Utilisez la réception individuelle ci-dessous.',unavailable:'Les données de réception ou d’inventaire sont incomplètes. Le traitement groupé est désactivé.',limit:'Plus de 50 propositions. Les 50 premières peuvent être reçues séparément.',from:'Facture',count:'Lignes proposées'},
 en:{heading:'Bulk purchase invoice receipt',intro:'Propose receiving multiple approved purchase lines with exactly matching inventory item names in one transaction. Admin approval is required.',none:'No safe, exact matches found. Use the individual receipt below.',unavailable:'Receipt history or inventory data is incomplete. Bulk processing has been disabled.',limit:'More than 50 suggestions; the first 50 can be received in a separate batch.',from:'Invoice',count:'Suggested lines'},
 de:{heading:'Sammelwareneingang aus Rechnungen',intro:'Mehrere genehmigte Rechnungspositionen mit exakt passenden Materialnamen in einer Transaktion übernehmen. Nur Admin kann bestätigen.',none:'Keine eindeutigen Übereinstimmungen. Einzelbuchungen unten verwenden.',unavailable:'Wareneingänge oder Inventardaten sind unvollständig. Sammelbuchung ist deaktiviert.',limit:'Mehr als 50 Vorschläge. Die ersten 50 können separat gebucht werden.',from:'Rechnung',count:'Vorgeschlagene Positionen'},
} as const

export default async function InventoryBulkReceipts({locale}:{locale:SupportedUiLocale}){
 const access=await administrationAccess()
 if(!access.ok||(!access.user.realIsAdmin&&!access.user.isOwner))return null
 const t=copy[locale]
 const db=access.db as unknown as SupabaseClient
 const invoices=await db.from('admin_financial_documents')
  .select('id,document_number,event_id')
  .eq('kind','purchase_invoice').in('status',['approved','issued','paid'])
  .not('event_id','is',null).order('created_at',{ascending:false}).limit(100)
 const ids=(invoices.data??[]).map(row=>row.id)
 if(invoices.error||!ids.length)return null
 const [lines,items]=await Promise.all([
  db.from('admin_financial_lines')
   .select('id,document_id,description,quantity').in('document_id',ids).order('id').limit(501),
  db.from('inventory_items').select('id,event_id,name')
   .in('event_id',[...new Set((invoices.data??[]).map(row=>row.event_id))])
   .eq('is_active',true).order('name').limit(501),
 ])
 const lineIds=(lines.data??[]).map(row=>row.id)
 const receipts=lineIds.length?await db.from('admin_inventory_receipts')
  .select('line_id,quantity').in('line_id',lineIds).limit(1001):
  {data:[],error:null}
 const complete=!lines.error&&!items.error&&!receipts.error&&
  (lines.data?.length??0)<501&&(items.data?.length??0)<501&&
  (receipts.data?.length??0)<1001
 return <section className="space-y-4 rounded-2xl border border-violet-500/40 p-5">
  <div><h2 className="text-lg font-semibold">{t.heading}</h2>
   <p className="mt-1 text-sm text-muted-foreground">{t.intro}</p></div>
  {!complete?<p role="alert" className="text-sm">{t.unavailable}</p>:
   (invoices.data??[]).map(invoice=>{
    const proposals=proposeExactInventoryReceipts(
     {id:invoice.id,event_id:invoice.event_id},
     (lines.data??[]).filter(row=>row.document_id===invoice.id)
      .map(row=>({...row,quantity:Number(row.quantity)})),
     (items.data??[]).filter(row=>row.event_id===invoice.event_id),
     (receipts.data??[]).map(row=>({...row,quantity:Number(row.quantity)})),
    )
    if(!proposals.length)return null
    return <details key={invoice.id} className="rounded-xl border p-4">
     <summary className="cursor-pointer font-semibold">
      {t.from}: {invoice.document_number??invoice.id.slice(0,8)}
      {' · '}{t.count}: {proposals.length}
     </summary>
     <div className="mt-3 space-y-2">
      {proposals.length>50&&<p role="status" className="text-xs text-amber-500">{t.limit}</p>}
      <InventoryBulkReceiptForm request={randomUUID()} document={invoice.id}
       proposals={proposals.slice(0,50)} locale={locale}/>
     </div>
    </details>
   })}
  {complete&&!(invoices.data??[]).some(invoice=>proposeExactInventoryReceipts(
   {id:invoice.id,event_id:invoice.event_id},
   (lines.data??[]).filter(row=>row.document_id===invoice.id)
    .map(row=>({...row,quantity:Number(row.quantity)})),
   (items.data??[]).filter(row=>row.event_id===invoice.event_id),
   (receipts.data??[]).map(row=>({...row,quantity:Number(row.quantity)})),
  ).length>0)&&<p className="text-sm text-muted-foreground">{t.none}</p>}
 </section>
}
