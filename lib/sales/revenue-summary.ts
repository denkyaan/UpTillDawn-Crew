/** Financial totals are shown only when every visible, RLS-scoped row was loaded. */
export const MAX_REVENUE_TRANSACTIONS=20_000

export type SalesRevenueRow={
  transaction_type:string
  total_cents:number|null
  payment_method:string
  sale_category:string
}

export function revenueCoverageComplete(expected:number|null,loaded:number):boolean{
  return expected!==null&&Number.isSafeInteger(expected)&&expected>=0&&
    expected<=MAX_REVENUE_TRANSACTIONS&&loaded===expected
}

export function summarizeSalesRevenue(rows:readonly SalesRevenueRow[]){
  const totals={event:0,merch:0,token:0,cash:0,card:0}
  for(const row of rows){
    if(row.total_cents===null||!Number.isSafeInteger(row.total_cents))throw Error('Invalid recorded sale amount')
    const signed=(row.transaction_type==='refund'?-1:1)*row.total_cents
    totals.event+=signed
    if(row.sale_category==='merch')totals.merch+=signed
    if(row.sale_category==='token')totals.token+=signed
    if(row.payment_method==='cash')totals.cash+=signed
    if(row.payment_method==='card')totals.card+=signed
  }
  if(Object.values(totals).some(amount=>!Number.isSafeInteger(amount)))throw Error('Sales total exceeds safe integer precision')
  return totals
}
