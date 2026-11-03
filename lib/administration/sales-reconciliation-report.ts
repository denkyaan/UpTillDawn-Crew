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
 const zero=():Record<SaleCategory,number>=>({tickets:0,merch:0,tokens:0})
 for(const payment of reconciled.accepted){
  let event=events.get(payment.eventId)
  if(!event){
   event={eventId:payment.eventId,netCents:zero(),paidCents:zero(),refundedCents:zero(),acceptedTransactions:0}
   events.set(payment.eventId,event)
  }
  const sign=payment.status==='refunded'?-1:1
  event.netCents[payment.category]+=sign*payment.amountCents
  if(payment.status==='refunded')event.refundedCents[payment.category]+=payment.amountCents
  else event.paidCents[payment.category]+=payment.amountCents
  event.acceptedTransactions++
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
 const rows:(string|number)[][]=[['event_id','category','paid_cents','refunded_cents','net_cents','accepted_transactions']]
 for(const event of report.events){
  for(const category of ['tickets','merch','tokens'] as const){
   rows.push([event.eventId,category,event.paidCents[category],event.refundedCents[category],event.netCents[category],event.acceptedTransactions])
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
