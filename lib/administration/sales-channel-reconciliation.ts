/** Pure reconciliation of external payment transactions against sales categories.
 * Does not mutate accounting, inventory or ticket records.
 */
export type SaleCategory='tickets'|'merch'|'tokens'
export type ExternalPayment={
 provider:'sumup'|'eventix';transactionId:string;eventId:string;category:SaleCategory;
 amountCents:number;currency:'EUR';status:'paid'|'refunded'|'pending';
 saleReference:string|null
}
export type SaleReconciliation={
 accepted:ExternalPayment[];pending:ExternalPayment[];duplicates:string[];
 conflicts:string[];unmatched:string[];totals:Record<SaleCategory,number>
}
const categories:SaleCategory[]=['tickets','merch','tokens']
/** Deduplicate by provider+transaction, and by a verified shared sale reference across providers.
 * Never assume matching amount/time implies matching sale.
 */
export function reconcileExternalSales(payments:readonly ExternalPayment[]):SaleReconciliation{
 const accepted:ExternalPayment[]=[],pending:ExternalPayment[]=[],duplicates:string[]=[],conflicts:string[]=[],unmatched:string[]=[]
 const totals:Record<SaleCategory,number>={tickets:0,merch:0,tokens:0}
 const ids=new Map<string,ExternalPayment>(),sales=new Map<string,ExternalPayment>()
 for(const p of payments){
  const id=p.provider+':'+p.transactionId
  if(!p.transactionId||!p.eventId||!categories.includes(p.category)||!Number.isSafeInteger(p.amountCents)||p.amountCents<0||p.currency!=='EUR'||!['paid','pending','refunded'].includes(p.status)){
   conflicts.push(id);continue
  }
  const previous=ids.get(id)
  if(previous){
   if(JSON.stringify(previous)===JSON.stringify(p))duplicates.push(id)
   else conflicts.push(id)
   continue
  }
  ids.set(id,p)
  if(p.status==='pending'){pending.push(p);continue}
  if(!p.saleReference){unmatched.push(id);continue}
  const saleKey=p.eventId+':'+p.category+':'+p.saleReference
  const prior=sales.get(saleKey)
  if(prior){
   if(prior.status===p.status&&prior.amountCents===p.amountCents){duplicates.push(id)}
   else conflicts.push(id)
   continue
  }
  sales.set(saleKey,p)
  accepted.push(p)
  const signed=p.status==='refunded'?-p.amountCents:p.amountCents
  const next=totals[p.category]+signed
  if(!Number.isSafeInteger(next)){conflicts.push(id);accepted.pop();sales.delete(saleKey);continue}
  totals[p.category]=next
 }
 return {accepted,pending,duplicates,conflicts,unmatched,totals}
}
