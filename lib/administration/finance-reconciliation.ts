export type FinanceReconciliation = {
 outstandingCents:number
 overpaymentCents:number
 issues:string[]
}
export function reconcileFinanceInvoice(grossCents:number,paidCents:number,creditedCents:number,status:string):FinanceReconciliation{
 if(![grossCents,paidCents,creditedCents].every(value=>Number.isSafeInteger(value)&&value>=0))
  throw new Error('Invalid financial cents')
 const settledCents=paidCents+creditedCents
 if(!Number.isSafeInteger(settledCents))throw new Error('Financial total overflow')
 const outstandingCents=Math.max(0,grossCents-settledCents)
 const overpaymentCents=Math.max(0,settledCents-grossCents)
 const issues:string[]=[]
 if(overpaymentCents>0)issues.push('overpayment')
 if(status==='paid'&&outstandingCents>0)issues.push('marked_paid_with_balance')
 if(['approved','issued'].includes(status)&&grossCents>0&&outstandingCents===0)issues.push('settled_but_not_marked_paid')
 if(status==='draft'&&settledCents>0)issues.push('unapproved_document_has_settlement')
 return {outstandingCents,overpaymentCents,issues}
}

/** Convert a Postgres numeric monetary amount to exact integer cents. Fail closed
 * for missing values, fractional cents, negatives and unsafe JS magnitudes. */
export function financialAmountCents(value:unknown):number{
 const amount=typeof value==='number'?value:typeof value==='string'&&value.trim()!==''?Number(value):NaN
 const rawCents=amount*100
 const cents=Math.round(rawCents)
 if(!Number.isFinite(amount)||amount<0||!Number.isSafeInteger(cents)||Math.abs(rawCents-cents)>0.000001)
  throw new Error('Invalid financial monetary amount')
 return cents
}
export function totalFinancialCents(amounts:readonly unknown[]):number{
 let cents=0
 for(const amount of amounts){
  cents+=financialAmountCents(amount)
  if(!Number.isSafeInteger(cents))throw new Error('Financial total overflow')
 }
 return cents
}
