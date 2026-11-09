import {parseCsv} from './ticket-import.ts'

export type BankStatementImportRow={
 transactionId:string;bookedOn:string;direction:'credit'|'debit';
 amountCents:number;paymentReference:string;description:string
}
export type BankStatementImport={
 rows:BankStatementImportRow[];errors:{line:number;message:string}[];
 creditCents:number;debitCents:number
}
const header='transaction_id,booked_on,direction,amount,currency,payment_reference,description'
const externalId=/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/
const amount=/^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/
const controls=/[\u0000-\u001f\u007f]/
const empty=():BankStatementImport=>({rows:[],errors:[],creditCents:0,debitCents:0})
function validDate(value:string):boolean{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false
 const date=Date.parse(value+'T00:00:00Z')
 return Number.isFinite(date)&&new Date(date).toISOString().slice(0,10)===value
}
/** Header-based CSV from a bank export, normalized manually before upload.
 * A claim in an imported CSV is not yet a verified bank receipt or a booked invoice payment.
 */
export function validateBankStatementCsv(csv:string,maxRows=500):BankStatementImport{
 const result=empty()
 if(typeof csv!=='string'||new TextEncoder().encode(csv).byteLength>1_000_000)
  return {...result,errors:[{line:1,message:'File too large'}]}
 if(!Number.isSafeInteger(maxRows)||maxRows<1||maxRows>500)
  return {...result,errors:[{line:1,message:'Invalid row limit'}]}
 let records:string[][]
 try{records=parseCsv(csv)}catch{return {...result,errors:[{line:1,message:'Invalid CSV quoting'}]}}
 if(!records.length||records[0].map(s=>s.trim().toLowerCase()).join(',')!==header)
  return {...result,errors:[{line:1,message:'Incorrect bank CSV columns'}]}
 if(records.length===1)return {...result,errors:[{line:1,message:'No bank transactions'}]}
 if(records.length-1>maxRows)return {...result,errors:[{line:1,message:'Too many bank transactions'}]}
 const seen=new Set<string>()
 for(let i=1;i<records.length;i++){
  const line=i+1,values=records[i]
  if(values.length!==7){result.errors.push({line,message:'Incorrect field count'});continue}
  const [transactionId,bookedOn,direction,rawAmount,currency,paymentReference,description]=values.map(v=>v.trim())
  if(!externalId.test(transactionId)||seen.has(transactionId)){
   result.errors.push({line,message:'Invalid or repeated transaction ID'});continue
  }
  if(!validDate(bookedOn)){result.errors.push({line,message:'Invalid booking date'});continue}
  if(direction!=='credit'&&direction!=='debit'){
   result.errors.push({line,message:'Invalid direction'});continue
  }
  if(currency!=='EUR'||!amount.test(rawAmount)){
   result.errors.push({line,message:'Invalid EUR amount'});continue
  }
  const [whole,fraction='']=rawAmount.split('.')
  const amountCents=Number(whole)*100+Number(fraction.padEnd(2,'0'))
  if(!Number.isSafeInteger(amountCents)||amountCents<=0||amountCents>99_999_999_999){
   result.errors.push({line,message:'Amount out of bounds'});continue
  }
  if(paymentReference.length>200||description.length>400||controls.test(paymentReference)||controls.test(description)){
   result.errors.push({line,message:'Invalid reference or description'});continue
  }
  seen.add(transactionId)
  result.rows.push({transactionId,bookedOn,direction,amountCents,paymentReference,description})
  if(direction==='credit')result.creditCents+=amountCents
  else result.debitCents+=amountCents
 }
 // Reject the whole file, not merely the malformed rows.
 if(result.errors.length)return {...empty(),errors:result.errors}
 return result
}
