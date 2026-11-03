import {reconcileExternalSales,type ExternalPayment,type SaleCategory} from './sales-channel-reconciliation.ts'

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
