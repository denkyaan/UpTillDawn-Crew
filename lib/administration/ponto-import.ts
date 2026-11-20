/** Trusted transformation of previously booked Ponto JSON:API transactions.
 * Never treat pending bank movements as posted receipts.
 * Provider account IDs form part of the deduplication key.
 */
import type {BankStatementImportRow} from "./bank-statement-import"

const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const money=/^-?(?:0|[1-9][0-9]{0,8})(?:\.[0-9]{1,2})?$/
const iso=/^\d{4}-\d{2}-\d{2}T/
const controls=/[\u0000-\u001f\u007f]/
const safeText=(raw:unknown,max:number):string=>{
 if(raw===null||raw===undefined)return ""
 if(typeof raw!=="string"||raw.length>max||controls.test(raw))throw Error("invalid_ponto_transaction")
 return raw.trim()
}
function bookedOn(value:unknown):string{
 if(typeof value!=="string"||!iso.test(value)||!Number.isFinite(Date.parse(value)))throw Error("invalid_ponto_booking_date")
 const date=value.slice(0,10)
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+"T00:00:00Z"))||
   new Date(date+"T00:00:00Z").toISOString().slice(0,10)!==date)throw Error("invalid_ponto_booking_date")
 return date
}
function cents(value:unknown):number{
 if(typeof value!=="number"||!Number.isFinite(value)||!money.test(String(value))||value===0)throw Error("invalid_ponto_amount")
 const [whole,fraction=""]=String(Math.abs(value)).split(".")
 const result=Number(whole)*100+Number(fraction.padEnd(2,"0"))
 if(!Number.isSafeInteger(result)||result<=0||result>99_999_999_999)throw Error("invalid_ponto_amount")
 return value<0?-result:result
}
export type PontoImportPage={rows:BankStatementImportRow[];nextCursor:string|null}
export function normalizePontoTransactions(input:unknown,accountId:string):PontoImportPage{
 if(!uuid.test(accountId)||!input||typeof input!=="object"||Array.isArray(input))throw Error("invalid_ponto_response")
 const body=input as Record<string,unknown>
 if(!Array.isArray(body.data)||body.data.length>100)throw Error("invalid_ponto_response")
 const rows:BankStatementImportRow[]=[]
 const seen=new Set<string>()
 for(const item of body.data){
  if(!item||typeof item!=="object"||Array.isArray(item))throw Error("invalid_ponto_transaction")
  const obj=item as Record<string,unknown>
  if(obj.type!=="transaction"||typeof obj.id!=="string"||!uuid.test(obj.id)||seen.has(obj.id))
   throw Error("invalid_ponto_transaction")
  seen.add(obj.id)
  const relationship=obj.relationships
  if(!relationship||typeof relationship!=="object"||!('account' in relationship))throw Error("invalid_ponto_account")
  const relation=(relationship as {account?:{data?:{id?:unknown;type?:unknown}}}).account?.data
  if(!relation||relation.type!=="account"||relation.id!==accountId)throw Error("invalid_ponto_account")
  const attributes=obj.attributes
  if(!attributes||typeof attributes!=="object"||Array.isArray(attributes))throw Error("invalid_ponto_transaction")
  const details=attributes as Record<string,unknown>
  if(details.currency!=="EUR")throw Error("unsupported_ponto_currency")
  const amountCents=cents(details.amount)
  const description=safeText(details.description,400)
  const reference=safeText(details.remittanceInformation??details.endToEndId,200)
  rows.push({
   transactionId:"PONTO:"+accountId+":"+obj.id,
   bookedOn:bookedOn(details.valueDate??details.executionDate),
   direction:amountCents>0?"credit":"debit",
   amountCents:Math.abs(amountCents),paymentReference:reference,description
  })
 }
 const links=body.links
 const hasNext=Boolean(links&&typeof links==="object"&&
  "next" in links&&typeof links.next==="string"&&links.next.length>0)
 if(hasNext&&rows.length===0)throw Error("invalid_ponto_paging")
 // The URL supplied by the provider is never followed; only its presence is
 // used, and the next cursor is derived from our validated last UUID.
 const nextCursor=hasNext?String((body.data as Array<{id:string}>).at(-1)?.id??""):null
 if(nextCursor!==null&&!uuid.test(nextCursor))throw Error("invalid_ponto_paging")
 return {rows,nextCursor}
}
