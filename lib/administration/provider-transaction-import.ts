import {parseCsv} from './ticket-import.ts'
import type {ExternalPayment} from './sales-channel-reconciliation.ts'

export type ProviderTransaction=Omit<ExternalPayment,'provider'> & {occurredAt:string}
export type ProviderTransactionBatch={
 rows:ProviderTransaction[]; errors:{line:number;message:string}[];
 paidCents:number;refundedCents:number;pendingCount:number
}
const externalId=/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/
const expectedHeader='transaction_id,external_event_id,category,sale_reference,status,amount,currency,occurred_at'
const timestamp=/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-](\d{2}):(\d{2}))$/
const money=/^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/

export function validateProviderTransactionCsv(
 csv:string,eventId:string,externalEventId:string,maxRows=500,provider:'eventix'|'sumup'|'eventpay'='eventix'
):ProviderTransactionBatch{
 const empty=():ProviderTransactionBatch=>({rows:[],errors:[],paidCents:0,refundedCents:0,pendingCount:0})
 const result=empty()
 if(typeof csv!=='string'||new TextEncoder().encode(csv).byteLength>1_000_000)
  return {...result,errors:[{line:1,message:'File exceeds 1 MB'}]}
 if(!['eventix','sumup','eventpay'].includes(provider))return {...result,errors:[{line:1,message:'Invalid provider'}]}
 if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(eventId)||!externalId.test(externalEventId))
  return {...result,errors:[{line:1,message:'Invalid event mapping'}]}
 if(!Number.isSafeInteger(maxRows)||maxRows<1||maxRows>500)
  return {...result,errors:[{line:1,message:'Invalid row limit'}]}
 let records:string[][]
 try{records=parseCsv(csv)}catch(error){return {...result,errors:[{line:1,message:(error as Error).message}]}}
 if(!records.length||records[0].map(value=>value.trim().toLowerCase()).join(',')!==expectedHeader)
  return {...result,errors:[{line:1,message:'Invalid transaction header'}]}
 if(records.length<2)return {...result,errors:[{line:1,message:'No transactions'}]}
 if(records.length-1>maxRows)return {...result,errors:[{line:1,message:'Too many transactions'}]}
 const seen=new Set<string>()
 for(let i=1;i<records.length;i++){
  const line=i+1
  if(records[i].length!==8){result.errors.push({line,message:'Incorrect column count'});continue}
  const [transactionId,external,category,reference,status,rawAmount,currency,rawDate]=records[i].map(value=>value.trim())
  const key=status+':'+transactionId
  if(!externalId.test(transactionId)||seen.has(key)){result.errors.push({line,message:'Invalid or duplicate transaction identifier'});continue}
  if(external!==externalEventId){result.errors.push({line,message:'External event mismatch'});continue}
  if(!(provider==='eventpay'?['bar','merch','topups'].includes(category):['tickets','merch','tokens'].includes(category))
    ||!['paid','pending','refunded'].includes(status)||currency!=='EUR'){
   result.errors.push({line,message:'Invalid category, status or currency'});continue
  }
  if(reference!==''&&!externalId.test(reference)){result.errors.push({line,message:'Invalid sale reference'});continue}
  if(!money.test(rawAmount)){
   result.errors.push({line,message:'Invalid EUR amount'});continue
  }
  const [whole,fraction='']=rawAmount.split('.')
  const amountCents=Number(whole)*100+Number(fraction.padEnd(2,'0'))
  if(!Number.isSafeInteger(amountCents)||amountCents<=0||amountCents>99_999_999_999){
   result.errors.push({line,message:'Invalid amount bounds'});continue
  }
  const parts=timestamp.exec(rawDate)
  const parsed=Date.parse(rawDate)
  const calendar=parts?Date.parse(parts[1]+'T00:00:00Z'):NaN
  if(!parts||!Number.isFinite(parsed)||!Number.isFinite(calendar)
   ||new Date(calendar).toISOString().slice(0,10)!==parts[1]
   ||Number(parts[2])>23||Number(parts[3])>59||Number(parts[4])>59
   ||(parts[6]!==undefined&&(Number(parts[6])>14||Number(parts[7])>59
      ||(Number(parts[6])===14&&Number(parts[7])!==0)))){
   result.errors.push({line,message:'Invalid timestamp'});continue
  }
  seen.add(key)
  if(status==='paid')result.paidCents+=amountCents
  if(status==='refunded')result.refundedCents+=amountCents
  if(status==='pending')result.pendingCount++
  if(!Number.isSafeInteger(result.paidCents)||!Number.isSafeInteger(result.refundedCents)){
   result.errors.push({line,message:'Unsafe batch total'});continue
  }
  result.rows.push({
   transactionId,eventId,category:category as ProviderTransaction['category'],
   saleReference:reference||null,status:status as ProviderTransaction['status'],
   amountCents,currency:'EUR',occurredAt:new Date(parsed).toISOString()
  })
 }
 if(result.errors.length)return {...empty(),errors:result.errors}
 return result
}
