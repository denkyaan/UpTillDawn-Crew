/**
 * Imported provider and bank CSV records are claims; a settlement requires
 * independent Admin review and atomic SQL authorization.
 */
export type SettlementTransaction={
 id:string;provider:'eventix'|'sumup';event_id:string;
 transaction_id:string;status:'paid'|'refunded';amount_cents:number
}
export type SettlementPreview={
 provider:'eventix'|'sumup';eventId:string;transactionCount:number;
 providerNetCents:number;feeCents:number;payoutCents:number
}
const maxCents=99_999_999_999
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function parseCents(value:unknown):number|null{
 if(typeof value!=='string'&&typeof value!=='number')return null
 const text=String(value)
 if(!/^(0|[1-9]\d{0,10})$/.test(text))return null
 const n=Number(text)
 return Number.isSafeInteger(n)&&n<=maxCents?n:null
}
export function parseEuroFee(value:string):number|null{
 if(!/^(?:0|[1-9]\d{0,8})(?:[.,]\d{1,2})?$/.test(value.trim()))return null
 const [units,sub='']=value.trim().replace(',','.').split('.')
 const cents=Number(units)*100+Number(sub.padEnd(2,'0'))
 return Number.isSafeInteger(cents)&&cents<=maxCents?cents:null
}
export function previewProviderSettlement(rows:readonly SettlementTransaction[],feeCents:number):SettlementPreview|null{
 if(rows.length<1||rows.length>500||!Number.isSafeInteger(feeCents)||feeCents<0||feeCents>maxCents)return null
 const first=rows[0]
 if(!first||!uuid.test(first.event_id)||!['eventix','sumup'].includes(first.provider))return null
 let net=0
 const ids=new Set<string>()
 for(const row of rows){
  if(!uuid.test(row.id)||ids.has(row.id)||row.provider!==first.provider||row.event_id!==first.event_id
    ||!['paid','refunded'].includes(row.status)
    ||!Number.isSafeInteger(row.amount_cents)||row.amount_cents<=0||row.amount_cents>maxCents)return null
  ids.add(row.id)
  net+=row.status==='refunded'?-row.amount_cents:row.amount_cents
  if(!Number.isSafeInteger(net))return null
 }
 if(net<=0||net>maxCents||feeCents>=net)return null
 return {provider:first.provider,eventId:first.event_id,transactionCount:rows.length,
  providerNetCents:net,feeCents,payoutCents:net-feeCents}
}
