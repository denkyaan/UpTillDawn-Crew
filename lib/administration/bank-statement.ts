import {parseCsv} from './ticket-import.ts'
import {financialAmountCents} from './finance-reconciliation.ts'

export type BankCsvRow={transactionReference:string;bookingDate:string;amountCents:number;counterpartyIban:string|null;description:string}
export type BankCsvBatch={rows:BankCsvRow[];errors:{line:number;message:string}[];netCents:number}
export type StoredBankEntry={id:string;bank_account_iban:string;transaction_reference:string;booking_date:string;amount_cents:number|string;counterparty_iban:string|null;description:string}
export type StoredLedgerPayment={id:string;document_id:string;amount:number|string;paid_on:string;bank_reference:string|null}
export type StoredLedgerDocument={id:string;kind:string;status:string;currency:string;document_number:string|null}
export type StoredBankMatch={id:string;entry_id:string;payment_id:string}
export type BankMatchView={entryId:string;state:'ready'|'ambiguous'|'unmatched'|'confirmed';paymentId:string|null;documentNumber:string|null}
const refPattern=/^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,159}$/
const euroPattern=/^-?(?:0|[1-9][0-9]{0,8})(?:\.[0-9]{1,2})?$/
const expectedHeader='transaction_reference,booking_date,amount,currency,counterparty_iban,description'

export function normalizeIban(value:string):string{return value.replace(/\s+/g,'').toUpperCase()}
export function validIban(value:string):boolean{
 const v=normalizeIban(value)
 if(!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(v)||v.length>34)return false
 const shifted=v.slice(4)+v.slice(0,4)
 let remainder=0
 for(const char of shifted){
  const digit=char>='A'&&char<='Z'?String(char.charCodeAt(0)-55):char
  for(const d of digit)remainder=(remainder*10+Number(d))%97
 }
 return remainder===1
}
function validDate(value:string):boolean{
 if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value))return false
 const t=Date.parse(value+'T00:00:00Z')
 return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===value
}
function signedCents(value:string):number|null{
 if(!euroPattern.test(value))return null
 const negative=value.startsWith('-')
 const [whole,fraction='']=(negative?value.slice(1):value).split('.')
 const cents=(Number(whole)*100+Number(fraction.padEnd(2,'0')))*(negative?-1:1)
 return Number.isSafeInteger(cents)&&cents!==0&&Math.abs(cents)<=99_999_999_999?cents:null
}
/** CSV schema is normalized, never provider/bank native. Partial batches never persist. */
export function validateBankStatementCsv(csv:string,bankAccountIban:string,maxRows=250):BankCsvBatch{
 const empty=():BankCsvBatch=>({rows:[],errors:[],netCents:0})
 const result=empty()
 if(typeof csv!=='string'||new TextEncoder().encode(csv).byteLength>500_000)
  return {...result,errors:[{line:1,message:'File exceeds 500 KB'}]}
 if(!validIban(bankAccountIban))return {...result,errors:[{line:1,message:'Invalid statement account IBAN'}]}
 if(!Number.isInteger(maxRows)||maxRows<1||maxRows>250)return {...result,errors:[{line:1,message:'Invalid row limit'}]}
 let records:string[][]
 try{records=parseCsv(csv)}catch{return {...result,errors:[{line:1,message:'Malformed CSV'}]}}
 if(!records.length||records[0].map(s=>s.trim().toLowerCase()).join(',')!==expectedHeader)
  return {...result,errors:[{line:1,message:'Invalid CSV header'}]}
 if(records.length<2||records.length>maxRows+1)
  return {...result,errors:[{line:1,message:'Invalid transaction count'}]}
 const ids=new Set<string>()
 for(let index=1;index<records.length;index++){
  const line=index+1
  if(records[index].length!==6){result.errors.push({line,message:'Invalid column count'});continue}
  const [ref,date,amount,currency,ibanRaw,description]=records[index].map(s=>s.trim())
  const normalizedIban=normalizeIban(ibanRaw)
  const cents=signedCents(amount)
  if(!refPattern.test(ref)||ids.has(ref)){result.errors.push({line,message:'Invalid or repeated transaction reference'});continue}
  if(!validDate(date)){result.errors.push({line,message:'Invalid booking date'});continue}
  if(cents===null||currency!=='EUR'){result.errors.push({line,message:'Invalid EUR amount'});continue}
  if(ibanRaw&&!validIban(ibanRaw)){result.errors.push({line,message:'Invalid counterparty IBAN'});continue}
  if(description.length>500){result.errors.push({line,message:'Description is too long'});continue}
  ids.add(ref)
  result.netCents+=cents
  if(!Number.isSafeInteger(result.netCents)){result.errors.push({line,message:'Unsafe batch sum'});continue}
  result.rows.push({transactionReference:ref,bookingDate:date,amountCents:cents,
   counterpartyIban:ibanRaw?normalizedIban:null,description})
 }
 if(result.errors.length)return {...empty(),errors:result.errors}
 return result
}
function parseCents(value:unknown):number{
 const raw=typeof value==='number'?String(value):value
 if(typeof raw!=='string'||! /^-?(?:0|[1-9][0-9]{0,11})$/.test(raw))throw Error('Invalid bank cents')
 const cents=Number(raw)
 if(!Number.isSafeInteger(cents)||cents===0||Math.abs(cents)>99_999_999_999)throw Error('Unsafe bank cents')
 return cents
}
/** Suggest an exact match ONLY when it is 1:1 by bank reference, booking date and signed amount.
 * Confirmation is distinct from recording a payment: no accounting mutation occurs here.
 */
export function reconcileBankStatementEntries(
 entries:readonly StoredBankEntry[],payments:readonly StoredLedgerPayment[],
 documents:readonly StoredLedgerDocument[],matches:readonly StoredBankMatch[]
):BankMatchView[]{
 if(entries.length>1000||payments.length>5000||documents.length>5000||matches.length>1000)
  throw Error('Reconciliation exceeds verified query bounds')
 const docMap=new Map<string,StoredLedgerDocument>()
 for(const d of documents){if(!d.id||docMap.has(d.id))throw Error('Duplicate or missing invoice');docMap.set(d.id,d)}
 const paymentMap=new Map<string,StoredLedgerPayment>(),candidateMap=new Map<string,string[]>()
 const key=(ref:string,date:string,cents:number)=>JSON.stringify([ref,date,cents])
 for(const p of payments){
  if(!p.id||paymentMap.has(p.id))throw Error('Duplicate or missing ledger payment')
  paymentMap.set(p.id,p)
  const d=docMap.get(p.document_id)
  if(!d||!['approved','issued','paid'].includes(d.status)||d.currency!=='EUR'
    ||!['sales_invoice','purchase_invoice'].includes(d.kind)||!p.bank_reference)continue
  if(!validDate(p.paid_on))throw Error('Invalid ledger payment date')
  const amount=financialAmountCents(p.amount)
  if(amount<=0)throw Error('Invalid ledger payment amount')
  const signed=amount*(d.kind==='purchase_invoice'?-1:1)
  const k=key(p.bank_reference,p.paid_on,signed)
  candidateMap.set(k,[...(candidateMap.get(k)??[]),p.id])
 }
 const byEntry=new Map<string,StoredBankMatch>(),byPayment=new Set<string>()
 for(const m of matches){
  if(byEntry.has(m.entry_id)||byPayment.has(m.payment_id))throw Error('Duplicate matched bank ledger records')
  byEntry.set(m.entry_id,m);byPayment.add(m.payment_id)
 }
 const entryIds=new Set<string>(),observationKeys=new Set<string>()
 const prepared=entries.map(e=>{
  if(!e.id||entryIds.has(e.id)||!validIban(e.bank_account_iban)||!validDate(e.booking_date)
   ||!refPattern.test(e.transaction_reference))throw Error('Invalid bank statement record')
  entryIds.add(e.id)
  const observation=JSON.stringify([e.bank_account_iban,e.transaction_reference])
  if(observationKeys.has(observation))throw Error('Duplicate bank transaction')
  observationKeys.add(observation)
  return {entry:e,amountCents:parseCents(e.amount_cents),
   candidates:candidateMap.get(key(e.transaction_reference,e.booking_date,parseCents(e.amount_cents)))??[]}
 })
 const frequency=new Map<string,number>()
 for(const row of prepared)if(row.candidates.length===1){
  const id=row.candidates[0];frequency.set(id,(frequency.get(id)??0)+1)
 }
 return prepared.map(({entry,candidates})=>{
  const existing=byEntry.get(entry.id)
  if(existing){
   if(!paymentMap.has(existing.payment_id)||!candidates.includes(existing.payment_id))
    throw Error('Persisted match no longer consistent with ledger')
   return {entryId:entry.id,state:'confirmed',paymentId:existing.payment_id,
    documentNumber:docMap.get(paymentMap.get(existing.payment_id)!.document_id)?.document_number??null}
  }
  const paymentId=candidates.length===1?candidates[0]:null
  if(!paymentId||frequency.get(paymentId)!==1||byPayment.has(paymentId))
   return {entryId:entry.id,state:candidates.length===0?'unmatched':'ambiguous',paymentId:null,documentNumber:null}
  const doc=docMap.get(paymentMap.get(paymentId)!.document_id)
  return {entryId:entry.id,state:'ready',paymentId,documentNumber:doc?.document_number??null}
 })
}
