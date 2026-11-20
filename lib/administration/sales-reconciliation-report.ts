import {reconcileExternalSales,type ExternalPayment,type SaleCategory} from './sales-channel-reconciliation.ts'
import {financeCsv} from './finance-report.ts'

export type EventSalesReport={
 eventId:string;
 netCents:Record<SaleCategory,number>;
 paidCents:Record<SaleCategory,number>;
 refundedCents:Record<SaleCategory,number>;
 acceptedTransactions:number;
}
export type SalesReconciliationReport={
 events:EventSalesReport[];
 totals:Record<SaleCategory,number>;
 exceptions:{conflicts:string[];unmatched:string[];duplicates:string[];pending:string[]};
 acceptedCount:number;
}
/** Read-only reporting. Input must already be authenticated and sourced from trusted providers.
 * No accounting posting, stock adjustment, or provider sync occurs here.
 */
export function buildSalesReconciliationReport(payments:readonly ExternalPayment[]):SalesReconciliationReport{
 const reconciled=reconcileExternalSales(payments)
 const events=new Map<string,EventSalesReport>()
 const zero=():Record<SaleCategory,number>=>({tickets:0,merch:0,tokens:0,bar:0,topups:0})
 for(const payment of reconciled.accepted){
  let event=events.get(payment.eventId)
  if(!event){
   event={eventId:payment.eventId,netCents:zero(),paidCents:zero(),refundedCents:zero(),acceptedTransactions:0}
   events.set(payment.eventId,event)
  }
  const sign=payment.status==='refunded'?-1:1
  const nextNet=event.netCents[payment.category]+sign*payment.amountCents
  if(!Number.isSafeInteger(nextNet))throw new RangeError('Unsafe event sales total')
  event.netCents[payment.category]=nextNet
  if(payment.status==='refunded'){
   const nextRefunded=event.refundedCents[payment.category]+payment.amountCents
   if(!Number.isSafeInteger(nextRefunded))throw new RangeError('Unsafe refunded sales total')
   event.refundedCents[payment.category]=nextRefunded
  }else{
   const nextPaid=event.paidCents[payment.category]+payment.amountCents
   if(!Number.isSafeInteger(nextPaid))throw new RangeError('Unsafe paid sales total')
   event.paidCents[payment.category]=nextPaid
  }
  event.acceptedTransactions++
 }
 // Verify event-level accounting balances before exposing or exporting a report.
 const summed=zero()
 for(const event of events.values()){
  for(const category of ['tickets','merch','tokens','bar','topups'] as const){
   if(event.paidCents[category]-event.refundedCents[category]!==event.netCents[category])
    throw new Error('Sales reconciliation event balance mismatch')
   summed[category]+=event.netCents[category]
   if(!Number.isSafeInteger(summed[category]))throw new RangeError('Unsafe consolidated sales total')
  }
 }
 for(const category of ['tickets','merch','tokens','bar','topups'] as const){
  if(summed[category]!==reconciled.totals[category])throw new Error('Sales reconciliation consolidated balance mismatch')
 }
 return {
  events:[...events.values()].sort((a,b)=>a.eventId.localeCompare(b.eventId)),
  totals:{...reconciled.totals},
  exceptions:{
   conflicts:[...reconciled.conflicts],
   unmatched:[...reconciled.unmatched],
   duplicates:[...reconciled.duplicates],
   pending:reconciled.pending.map(p=>JSON.stringify([p.provider,p.transactionId]))
  },
  acceptedCount:reconciled.accepted.length
 }
}

/** Export only accepted reconciled movements. Exceptions remain separate and cannot be mistaken for booked revenue. */
export function salesReconciliationCsv(report:SalesReconciliationReport):string{
 const rows:(string|number)[][]=[['event_id','category','paid_cents','refunded_cents','net_cents','accepted_transactions','accounting_classification']]
 for(const event of report.events){
  for(const category of ['tickets','merch','tokens','bar','topups'] as const){
   rows.push([event.eventId,category,event.paidCents[category],event.refundedCents[category],event.netCents[category],event.acceptedTransactions,category==='topups'?'prepaid-liability':'sale'])
  }
 }
 return financeCsv(rows)
}
/** A separate exception export supports manual review without leaking provider credentials. */
export function salesReconciliationExceptionsCsv(report:SalesReconciliationReport):string{
 const rows:(string|number)[][]=[['type','transaction_reference']]
 for(const type of ['conflicts','unmatched','duplicates','pending'] as const){
  for(const id of report.exceptions[type])rows.push([type,id])
 }
 return financeCsv(rows)
}
