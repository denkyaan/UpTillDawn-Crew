import type {BankStatementImportRow} from "./bank-statement-import"

const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const controls=/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/

type PontoPage={rows:BankStatementImportRow[];next:string|null}

/** Only authenticated, booked EUR Ponto account transactions may enter the bank
 * statement review ledger; never create invoice payments or initiate transfers.
 */
export function normalizePontoBankPage(input:unknown,accountId:string):PontoPage{
 if(!uuid.test(accountId)||!input||typeof input!=="object"||Array.isArray(input))throw Error("invalid_ponto_page")
 const page=input as Record<string,unknown>
 if(!Array.isArray(page.data)||page.data.length>100)throw Error("invalid_ponto_page")
 const seen=new Set<string>(),rows:BankStatementImportRow[]=[]
 for(const raw of page.data){
  if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("invalid_ponto_row")
  const record=raw as Record<string,unknown>
  if(record.type!=="transaction"||typeof record.id!=="string"||!uuid.test(record.id)||seen.has(record.id))
   throw Error("invalid_ponto_row")
  seen.add(record.id)
  if(!record.attributes||typeof record.attributes!=="object"||Array.isArray(record.attributes))
   throw Error("invalid_ponto_row")
  const a=record.attributes as Record<string,unknown>
  if(a.currency!=="EUR"||typeof a.amount!=="number"||!Number.isFinite(a.amount)||a.amount===0||
     !Number.isSafeInteger(Math.round(Math.abs(a.amount)*100))||
     Math.abs(Math.abs(a.amount)*100-Math.round(Math.abs(a.amount)*100))>0.00001)
   throw Error("invalid_ponto_amount")
  const amountCents=Math.round(Math.abs(a.amount)*100)
  if(amountCents<1||amountCents>99_999_999_999)throw Error("invalid_ponto_amount")
  const date=typeof a.executionDate==="string"?a.executionDate:a.valueDate
  if(typeof date!=="string"||!/^\d{4}-\d{2}-\d{2}T/.test(date)||!Number.isFinite(Date.parse(date)))
   throw Error("invalid_ponto_date")
  const bookedOn=date.slice(0,10)
  if(new Date(bookedOn+"T00:00:00Z").toISOString().slice(0,10)!==bookedOn)throw Error("invalid_ponto_date")
  const relation=(record.relationships as Record<string,unknown>|undefined)?.account
  if(!relation||typeof relation!=="object"||!("data" in relation)||!relation.data||
     typeof relation.data!=="object"||!("id" in relation.data)||relation.data.id!==accountId)
   throw Error("ponto_account_mismatch")
  const text=(value:unknown,max:number)=>{
   if(value===null||value===undefined)return ""
   if(typeof value!=="string"||controls.test(value))throw Error("invalid_ponto_text")
   const normalized=value.replace(/[\r\n\t]+/g," ").trim()
   if(normalized.length>max)return null
   return normalized
  }
  const paymentReference=text(a.remittanceInformation,200)
  const description=text(a.description,400)
  if(paymentReference===null||description===null)throw Error("invalid_ponto_text")
  rows.push({
   transactionId:"ponto:"+accountId+":"+record.id,
   bookedOn,direction:a.amount>0?"credit":"debit",amountCents,
   paymentReference,description
  })
 }
 let next:string|null=null
 const links=page.links
 if(links!==null&&links!==undefined){
  if(typeof links!=="object"||Array.isArray(links))throw Error("invalid_ponto_links")
  const candidate=(links as Record<string,unknown>).next
  if(candidate!==null&&candidate!==undefined){
   if(typeof candidate!=="string"||candidate.length>1024)throw Error("invalid_ponto_links")
   let url:URL
   try{url=new URL(candidate)}catch{throw Error("invalid_ponto_links")}
   const limit=url.searchParams.get("page[limit]")
   const after=url.searchParams.get("page[after]")
   if(url.origin!=="https://api.myponto.com"||
      url.pathname!=="/accounts/"+accountId+"/transactions"||
      [...url.searchParams.keys()].some(key=>!["page[limit]","page[after]"].includes(key))||
      (limit!==null&&( !/^[1-9][0-9]?$|^100$/.test(limit)))||
      !after||!uuid.test(after))throw Error("invalid_ponto_links")
   next=after
  }
 }
 return {rows,next}
}
