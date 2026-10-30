import {reconcilePayments, type ReconciliationResult} from './payment-reconciliation.ts'

/** Convert persisted decimal-euro values to integer cents without floating point rounding drift. */
export function euroToCents(value:unknown):number{
 const raw=typeof value==='number'?String(value):value
 if(typeof raw!=='string'||!/^(?:0|[1-9]\d{0,12})(?:\.\d{1,2})?$/.test(raw))throw new Error('Invalid EUR amount')
 const [whole,fraction='']=raw.split('.')
 const cents=Number(whole)*100+Number(fraction.padEnd(2,'0'))
 if(!Number.isSafeInteger(cents))throw new Error('EUR amount exceeds safe range')
 return cents
}
export type StoredDocument={id:string;gross_amount:number|string|null;status:string;currency:string|null}
export type StoredPayment={id:string;document_id:string;amount:number|string|null}
export function reconcileStoredLedger(documents:readonly StoredDocument[],payments:readonly StoredPayment[]):ReconciliationResult{
 return reconcilePayments(documents.map(d=>({id:d.id,grossCents:euroToCents(d.gross_amount),status:d.status,currency:d.currency??'EUR'})),payments.map(p=>({id:p.id,documentId:p.document_id,amountCents:euroToCents(p.amount),currency:'EUR'})))
}
