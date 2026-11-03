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
 const refundedCents=new Map<string,number>()
 // Process paid records before refunds so provider delivery order cannot create false orphan refunds.
 for(const p of [...payments].sort((a,b)=>Number(a?.status==='refunded')-Number(b?.status==='refunded'))){
  const id=p.provider+':'+p.transactionId
  if(typeof p.transactionId!=='string'||!p.transactionId.trim()||typeof p.eventId!=='string'||!p.eventId.trim()||!categories.includes(p.category)||!Number.isSafeInteger(p.amountCents)||p.amountCents<0||(p.status==='refunded'&&p.amountCents===0)||p.currency!=='EUR'||!['paid','pending','refunded'].includes(p.status)){
   conflicts.push(id);continue
  }
  const transactionKey=JSON.stringify([p.provider,p.transactionId])
  const previous=ids.get(transactionKey)
  if(previous){
   if(JSON.stringify(previous)===JSON.stringify(p))duplicates.push(id)
   else conflicts.push(id)
   continue
  }
  ids.set(transactionKey,p)
  if(p.status==='pending'){pending.push(p);continue}
  if(typeof p.saleReference!=='string'||!p.saleReference.trim()){unmatched.push(id);continue}
  const saleKey=JSON.stringify([p.eventId,p.category,p.saleReference])
  // Refunds are separate ledger movements, never duplicates of the original sale.
  // A refund must match a previously accepted paid sale, not an unrelated reference.
  if(p.status==='refunded'){
   const original=sales.get(saleKey)
   const alreadyRefunded=refundedCents.get(saleKey)??0
   if(!original||original.status!=='paid'||p.amountCents>original.amountCents-alreadyRefunded){
    conflicts.push(id);continue
   }
   const next=totals[p.category]-p.amountCents
   if(!Number.isSafeInteger(next)){conflicts.push(id);continue}
   refundedCents.set(saleKey,alreadyRefunded+p.amountCents);accepted.push(p);totals[p.category]=next;continue
  }
  const prior=sales.get(saleKey)
  if(prior){
   if(prior.status===p.status&&prior.amountCents===p.amountCents&&prior.currency===p.currency){duplicates.push(id)}
   else conflicts.push(id)
   continue
  }
  sales.set(saleKey,p)
  accepted.push(p)
  const next=totals[p.category]+p.amountCents
  if(!Number.isSafeInteger(next)){conflicts.push(id);accepted.pop();sales.delete(saleKey);continue}
  totals[p.category]=next
 }
 return {accepted,pending,duplicates,conflicts,unmatched,totals}
}
