import 'server-only'
import type {SupabaseClient} from '@supabase/supabase-js'
import {preparePeppol,type PeppolParty,type PeppolDocument,type PeppolLine} from './peppol'

export const billingFields=['name','street_address','postal_code','city','country_code','enterprise_number','vat_number','tax_registration','peppol_endpoint','iban'] as const
export function billingParty(row:Record<string,unknown>|null):PeppolParty{
 return Object.fromEntries(billingFields.map(key=>[key,String(row?.[key]??'')])) as PeppolParty
}
export async function loadPeppolPreparation(db:SupabaseClient,id:string){
 const {data:doc,error}=await db.from('admin_financial_documents').select('id,kind,status,document_number,issue_date,due_date,currency,net_amount,tax_amount,gross_amount,buyer_reference,order_reference,delivery_date,delivery_country,notes,counterparty_id,original_invoice_id').eq('id',id).maybeSingle()
 if(error)return {error:'unavailable' as const}
 if(!doc)return {error:'not_found' as const}
 const [profile,customer,lineResult,original,payments]=await Promise.all([
  db.from('admin_billing_profile').select('*').eq('singleton',true).maybeSingle(),
  doc.counterparty_id?db.from('admin_counterparties').select('*').eq('id',doc.counterparty_id).maybeSingle():Promise.resolve({data:null,error:null}),
  db.from('admin_financial_lines').select('id,description,quantity,unit_price,vat_rate,unit_code,vat_category,vat_exemption_reason').eq('document_id',id).order('created_at').order('id').limit(1001),
  doc.original_invoice_id?db.from('admin_financial_documents').select('kind,status,document_number,issue_date,currency,counterparty_id').eq('id',doc.original_invoice_id).maybeSingle():Promise.resolve({data:null,error:null}),
  db.from('admin_financial_payments').select('amount').eq('document_id',id).order('id').limit(1001),
 ])
 if(profile.error||customer.error||lineResult.error||original.error||payments.error||(payments.data?.length??0)>1000)return {error:'unavailable' as const}
 const prepared=preparePeppol({document:doc as PeppolDocument,seller:billingParty(profile.data),buyer:billingParty(customer.data),lines:(lineResult.data??[]) as PeppolLine[],payments:payments.data?.map(row=>row.amount),original:original.data,counterparty_id:doc.counterparty_id,profileApproved:Boolean(profile.data?.approved_by&&profile.data?.approved_at)})
 return {error:null,document:{id:doc.id,number:doc.document_number,kind:doc.kind,status:doc.status},...prepared}
}
