import Link from 'next/link'
import {revalidatePath} from 'next/cache'
import {redirect} from 'next/navigation'
import type {SupabaseClient} from '@supabase/supabase-js'
import {administrationPageAccess} from '@/lib/administration/page-access'
import type {SupportedUiLocale} from '@/lib/locale-preferences'
import {peppolCopy,peppolFieldLabels,localeIndex} from '@/lib/administration/peppol-copy'
import {peppolVatCategories,type PeppolLine} from '@/lib/administration/peppol'

const path='/portals/administration/finance'
async function saveReferences(form:FormData){
 'use server'
 const access=await administrationPageAccess(),id=String(form.get('document_id')??'')
 if(!access.ok||!/^[0-9a-f-]{36}$/i.test(id))redirect(path+'?error=1')
 const db=access.db as unknown as SupabaseClient
 const {data:doc}=await db.from('admin_financial_documents').select('status').eq('id',id).maybeSingle()
 if(!doc||doc.status==='void'||(doc.status!=='draft'&&!access.user.isAdmin&&!access.user.isOwner))redirect(path+'?error=1')
 const buyer=String(form.get('buyer_reference')??'').trim(),order=String(form.get('order_reference')??'').trim(),date=String(form.get('delivery_date')??''),country=String(form.get('delivery_country')??'').trim().toUpperCase()
 if(buyer.length>200||order.length>200||/[\u0000-\u001f]/.test(buyer+order)||(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date))||(country&&!/^[A-Z]{2}$/.test(country)))redirect(path+'?error=1')
 const {data,error}=await db.from('admin_financial_documents').update({buyer_reference:buyer||null,order_reference:order||null,delivery_date:date||null,delivery_country:country||null}).eq('id',id).eq('status',doc.status).select('id')
 if(error||data?.length!==1)redirect(path+'?error=1')
 revalidatePath(path)
 revalidatePath(`/portals/administration/modules/invoices/${id}/peppol`)
}
async function saveLine(form:FormData){
 'use server'
 const access=await administrationPageAccess(),id=String(form.get('line_id')??''),documentId=String(form.get('document_id')??'')
 if(!access.ok||![id,documentId].every(value=>/^[0-9a-f-]{36}$/i.test(value)))redirect(path+'?error=1')
 const db=access.db as unknown as SupabaseClient,unit=String(form.get('unit_code')??'C62'),category=String(form.get('vat_category')??''),reason=String(form.get('vat_exemption_reason')??'').trim()
 if(!/^[A-Z0-9]{1,3}$/.test(unit)||(category&&!(peppolVatCategories as readonly string[]).includes(category))||reason.length>500||/[\u0000-\u001f]/.test(reason))redirect(path+'?error=1')
 const {data:doc}=await db.from('admin_financial_documents').select('status').eq('id',documentId).maybeSingle()
 if(doc?.status!=='draft')redirect(path+'?error=1')
 const {data,error}=await db.from('admin_financial_lines').update({unit_code:unit,vat_category:category||null,vat_exemption_reason:reason||null}).eq('id',id).eq('document_id',documentId).select('id')
 if(error||data?.length!==1)redirect(path+'?error=1')
 revalidatePath(path)
 revalidatePath(`/portals/administration/modules/invoices/${documentId}/peppol`)
}
const vatLabels={S:['Normaal belast','Taux normal','Standard rated','Regelbesteuert'],Z:['Nultarief','Taux zéro','Zero rated','Nullsatz'],E:['Vrijgesteld','Exonéré','Exempt','Steuerbefreit'],AE:['Btw verlegd','Autoliquidation','Reverse charge','Steuerschuldumkehr'],K:['Intracommunautair','Livraison intracommunautaire','Intra-community supply','Innergemeinschaftliche Lieferung'],G:['Uitvoer buiten de EU','Export hors UE','Export outside the EU','Ausfuhr außerhalb der EU'],O:['Buiten de btw','Hors champ TVA','Outside VAT','Nicht umsatzsteuerpflichtig']} as const
const units={C62:['Eenheid','Unité','Unit','Einheit'],H87:['Stuk','Pièce','Piece','Stück'],HUR:['Uur','Heure','Hour','Stunde'],DAY:['Dag','Jour','Day','Tag'],KTM:['Kilometer','Kilomètre','Kilometre','Kilometer'],KGM:['Kilogram','Kilogramme','Kilogram','Kilogramm'],LTR:['Liter','Litre','Litre','Liter'],MTR:['Meter','Mètre','Metre','Meter']} as const
type Document={id:string;kind:string;status:string;buyer_reference?:string|null;order_reference?:string|null;delivery_date?:string|null;delivery_country?:string|null}
export default function PeppolDocumentFields({document:doc,lines,canEnrich,locale,preparationLink=true}:{document:Document;lines:PeppolLine[];canEnrich:boolean;locale:SupportedUiLocale;preparationLink?:boolean}){
 if(!['sales_invoice','credit_note'].includes(doc.kind))return null
 const t=peppolCopy[locale],index=localeIndex[locale],editable=doc.status==='draft'||(canEnrich&&doc.status!=='void')
 return <details className="rounded-lg border p-3 text-sm"><summary className="cursor-pointer font-semibold">{t.reference}</summary><div className="mt-3 space-y-3">
  {preparationLink&&<Link href={`/portals/administration/modules/invoices/${doc.id}/peppol`} className="block text-violet-400 underline">{t.title}</Link>}
  {editable&&<form action={saveReferences} className="grid gap-2 sm:grid-cols-2"><input type="hidden" name="document_id" value={doc.id}/>
   {(['buyer_reference','order_reference','delivery_date','delivery_country'] as const).map(key=><label key={key}>{peppolFieldLabels[key][index]}<input name={key} defaultValue={doc[key]??''} type={key==='delivery_date'?'date':'text'} maxLength={key==='delivery_country'?2:200} className="block w-full rounded border bg-background p-2"/></label>)}
   <button className="rounded-lg border border-violet-500 p-2" type="submit">{t.metadataSave}</button>
  </form>}
  {doc.status==='draft'&&lines.map(line=><form action={saveLine} key={line.id} className="grid gap-2 rounded border p-3 sm:grid-cols-3"><input type="hidden" name="document_id" value={doc.id}/><input type="hidden" name="line_id" value={line.id}/><strong className="sm:col-span-3">{line.description}</strong>
   <label>{t.unit}<select name="unit_code" defaultValue={line.unit_code??'C62'} className="block w-full rounded border bg-background p-2">{line.unit_code&&!(line.unit_code in units)&&<option value={line.unit_code}>{line.unit_code}</option>}{Object.entries(units).map(([code,label])=><option key={code} value={code}>{label[index]} ({code})</option>)}</select></label>
   <label>{t.vat}<select name="vat_category" defaultValue={line.vat_category??''} className="block w-full rounded border bg-background p-2"><option value="">{t.automatic}</option>{peppolVatCategories.map(code=><option value={code} key={code}>{vatLabels[code][index]} ({code})</option>)}</select></label>
   <label>{t.exemption}<input name="vat_exemption_reason" maxLength={500} defaultValue={line.vat_exemption_reason??''} className="block w-full rounded border bg-background p-2"/></label>
   <button type="submit" className="rounded-lg border p-2">{t.metadataSave}</button>
  </form>)}
 </div></details>
}
