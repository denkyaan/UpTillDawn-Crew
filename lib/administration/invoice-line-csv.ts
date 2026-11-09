import {parseCsv} from './ticket-import.ts'

export type InvoiceCsvLine={description:string;quantity:string;unitPrice:string;vatRate:string}
export type InvoiceCsvResult={rows:InvoiceCsvLine[];errors:{line:number;message:string}[];netCents:number;taxCents:number}
export const invoiceCsvHeader='description,quantity,unit_price,vat_rate'
const control=/[\u0000-\u001f\u007f]/
const qty=/^(?:0|[1-9][0-9]{0,5})(?:\.[0-9]{1,3})?$/
const price=/^(?:0|[1-9][0-9]{0,6})(?:\.[0-9]{1,4})?$/
const vat=/^(?:0|[1-9][0-9]{0,2})(?:\.[0-9]{1,2})?$/
const maxCentTotal=BigInt('9999999999999')
function scaled(value:string,places:number):bigint{
 const [whole,fraction='']=value.split('.')
 return BigInt(whole)*BigInt('1'+'0'.repeat(places))+BigInt(fraction.padEnd(places,'0'))
}
/** This is normalized supplier data, not OCR or a verified invoice.
 * Reject the full batch on any invalid row; never silently round source inputs.
 */
export function validateInvoiceLinesCsv(csv:string):InvoiceCsvResult{
 const blank=():InvoiceCsvResult=>({rows:[],errors:[],netCents:0,taxCents:0})
 const result=blank()
 if(typeof csv!=='string'||new TextEncoder().encode(csv).byteLength>100_000)
  return {...result,errors:[{line:1,message:'File is too large'}]}
 let records:string[][]
 try{records=parseCsv(csv)}catch{return {...result,errors:[{line:1,message:'Malformed CSV'}]}}
 if(!records.length||records[0].map(v=>v.trim().toLowerCase()).join(',')!==invoiceCsvHeader)
  return {...result,errors:[{line:1,message:'Invalid CSV header'}]}
 if(records.length<2||records.length>101)
  return {...result,errors:[{line:1,message:'Batch must contain 1 to 100 lines'}]}
 let netScaled=BigInt(0),taxCents=BigInt(0)
 for(let i=1;i<records.length;i++){
  const fields=records[i]
  if(fields.length!==4){result.errors.push({line:i+1,message:'Invalid column count'});continue}
  const [description,quantity,unitPrice,vatRate]=fields.map(v=>v.trim())
  if(!description||description.length>500||control.test(description)||/^[=+@-]/.test(description)){
   result.errors.push({line:i+1,message:'Unsafe or invalid description'});continue
  }
  if(!qty.test(quantity)||!price.test(unitPrice)||!vat.test(vatRate)){
   result.errors.push({line:i+1,message:'Invalid decimal precision'});continue
  }
  const q=scaled(quantity,3),p=scaled(unitPrice,4),r=scaled(vatRate,2)
  if(q<=BigInt(0)||q>BigInt(100000000)||p>BigInt(99999990000)||r>BigInt(10000)){
   result.errors.push({line:i+1,message:'Amount outside allowed bounds'});continue
  }
  const lineNet=q*p
  netScaled+=lineNet
  taxCents+=(lineNet*r+BigInt(500000000))/BigInt(1000000000)
  if(netScaled/BigInt(100000)>maxCentTotal||taxCents>maxCentTotal){
   result.errors.push({line:i+1,message:'Invoice total exceeds safe bounds'});continue
  }
  result.rows.push({description,quantity,unitPrice,vatRate})
 }
 if(result.errors.length)return {...blank(),errors:result.errors}
 const netCents=(netScaled+BigInt(50000))/BigInt(100000)
 if(netCents>maxCentTotal||netCents+taxCents>maxCentTotal)
  return {...blank(),errors:[{line:1,message:'Invoice total exceeds safe bounds'}]}
 result.netCents=Number(netCents)
 result.taxCents=Number(taxCents)
 return result
}
