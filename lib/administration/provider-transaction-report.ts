import {buildSalesReconciliationReport} from './sales-reconciliation-report.ts'
import type {ExternalPayment} from './sales-channel-reconciliation.ts'

export type StoredProviderTransaction={
 id:string;event_id:string;provider:string;transaction_id:string;
 category:string;sale_reference:string|null;status:string;amount_cents:number|string;
 currency:string;occurred_at:string
}
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const external=/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/
function cents(value:unknown):number{
 const raw=typeof value==='number'?String(value):value
 if(typeof raw!=='string'||!/^[1-9]\d{0,10}$/.test(raw))throw Error('Invalid transaction amount')
 const number=Number(raw)
 if(!Number.isSafeInteger(number)||number>99_999_999_999)throw Error('Unsafe transaction amount')
 return number
}
/** Database outputs are untrusted until the entire result set passes validation. */
export function decodeProviderTransactions(value:unknown):ExternalPayment[]{
 if(!Array.isArray(value)||value.length>5000)throw Error('Invalid provider report size')
 const seen=new Set<string>()
 return value.map((item:unknown)=>{
  if(!item||typeof item!=='object'||Array.isArray(item))throw Error('Invalid provider report row')
  const row=item as Record<string,unknown>
  if(typeof row.id!=='string'||!uuid.test(row.id)||typeof row.event_id!=='string'||!uuid.test(row.event_id)
   ||(row.provider!=='eventix'&&row.provider!=='sumup'&&row.provider!=='eventpay')
   ||typeof row.transaction_id!=='string'||!external.test(row.transaction_id)
   ||!(row.provider==='eventpay'
     ? ['bar','merch','topups'].includes(String(row.category))
     : ['tickets','merch','tokens'].includes(String(row.category)))
   ||(row.sale_reference!==null&&(typeof row.sale_reference!=='string'||!external.test(row.sale_reference)))
   ||!['paid','pending','refunded'].includes(String(row.status))||row.currency!=='EUR'
   ||typeof row.occurred_at!=='string'||!Number.isFinite(Date.parse(row.occurred_at)))
   throw Error('Invalid provider transaction shape')
  const key=JSON.stringify([row.provider,row.transaction_id,row.status])
  if(seen.has(key))throw Error('Duplicate provider transaction snapshot')
  seen.add(key)
  return {
   provider:row.provider as ExternalPayment['provider'],
   transactionId:row.transaction_id,
   eventId:row.event_id,
   category:row.category as ExternalPayment['category'],
   saleReference:row.sale_reference as string|null,
   status:row.status as ExternalPayment['status'],
   amountCents:cents(row.amount_cents),
   currency:'EUR' as const
  }
 })
}
export function reportProviderTransactions(value:unknown){
 return buildSalesReconciliationReport(decodeProviderTransactions(value))
}
