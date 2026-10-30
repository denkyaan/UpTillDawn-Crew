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
