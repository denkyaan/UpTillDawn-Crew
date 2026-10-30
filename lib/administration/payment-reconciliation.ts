/** Deterministic, side-effect-free reconciliation of recorded payments to approved documents.
 * Monetary amounts are integer euro cents. Never updates accounting records itself.
 */
export type ReconciliationDocument={id:string;grossCents:number;status:string;currency:string}
export type ReconciliationPayment={id:string;documentId:string;amountCents:number;currency:string}
export type ReconciliationLine={documentId:string;grossCents:number;paidCents:number;remainingCents:number;state:'unpaid'|'partial'|'settled'|'overpaid'}
export type ReconciliationResult={lines:ReconciliationLine[];unmatchedPaymentIds:string[];errors:string[];balanced:boolean}
export function reconcilePayments(documents:readonly ReconciliationDocument[],payments:readonly ReconciliationPayment[]):ReconciliationResult{
 const errors:string[]=[];const unmatchedPaymentIds:string[]=[];const seenDocs=new Set<string>();const seenPayments=new Set<string>();const sums=new Map<string,number>();
 for(const doc of documents){
  if(!doc.id||seenDocs.has(doc.id))errors.push(`Duplicate or missing document ID: ${doc.id}`)
  seenDocs.add(doc.id)
  if(!Number.isSafeInteger(doc.grossCents)||doc.grossCents<0||doc.currency!=='EUR')errors.push(`Invalid document amount/currency: ${doc.id}`)
 }
 for(const payment of payments){
  if(!payment.id||seenPayments.has(payment.id)){errors.push(`Duplicate or missing payment ID: ${payment.id}`);continue}
  seenPayments.add(payment.id)
  if(!Number.isSafeInteger(payment.amountCents)||payment.amountCents<=0||payment.currency!=='EUR'){
   errors.push(`Invalid payment amount/currency: ${payment.id}`);continue
  }
  if(!seenDocs.has(payment.documentId)){unmatchedPaymentIds.push(payment.id);continue}
  const sum=(sums.get(payment.documentId)??0)+payment.amountCents
  if(!Number.isSafeInteger(sum)){errors.push(`Payment sum overflow: ${payment.documentId}`);continue}
  sums.set(payment.documentId,sum)
 }
 const lines=documents.map(doc=>{
  const paidCents=sums.get(doc.id)??0;const remainingCents=doc.grossCents-paidCents
  return {documentId:doc.id,grossCents:doc.grossCents,paidCents,remainingCents,state:(paidCents===0?'unpaid':remainingCents<0?'overpaid':remainingCents===0?'settled':'partial') as ReconciliationLine['state']}
 })
 return {lines,unmatchedPaymentIds,errors,balanced:errors.length===0&&unmatchedPaymentIds.length===0&&lines.every(line=>line.state==='settled')}
}
