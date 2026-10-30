/** Strict, side-effect-free ticket-sales CSV validation before any database mutation. */
export type TicketSale = {externalId:string;eventId:string;quantity:number;grossCents:number;currency:string;soldAt:string}
export type TicketImportResult = {rows:TicketSale[];errors:{line:number;message:string}[];grossCents:number;quantity:number}

function parseCsv(input:string):string[][] {
 const rows:string[][]=[];let row:string[]=[];let cell="";let state:"start"|"plain"|"quoted"|"closed"="start"
 const source=input.replace(/^\uFEFF/,"")
 for(let i=0;i<source.length;i++){
  const ch=source[i]
  if(state==="quoted"){
   if(ch==='"'&&source[i+1]==='"'){cell+='"';i++}
   else if(ch==='"')state="closed"
   else cell+=ch
   continue
  }
  if(ch==='"'){
   if(state==="start"){state="quoted";continue}
   throw Error('Unexpected quote')
  }
  if(ch===','){
   row.push(cell);cell="";state="start";continue
  }
  if(ch==='\n'||ch==='\r'){
   if(ch==='\r'&&source[i+1]==='\n')i++
   row.push(cell);if(row.some(x=>x.trim()))rows.push(row)
   row=[];cell="";state="start";continue
  }
  if(state==="closed")throw Error('Unexpected characters after closing quote')
  if(state==="start")state="plain"
  cell+=ch
 }
 if(state==="quoted")throw Error('Unterminated quoted field')
 row.push(cell);if(row.some(x=>x.trim()))rows.push(row)
 return rows
}
function moneyToCents(value:string):number|null {
 if(!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(value))return null
 const [whole,fraction='']=value.split('.');const result=Number(whole)*100+Number(fraction.padEnd(2,'0'))
 return Number.isSafeInteger(result)?result:null
}
export function validateTicketSalesCsv(csv:string,expectedEventId:string,maxRows=10000):TicketImportResult {
 const result:TicketImportResult={rows:[],errors:[],grossCents:0,quantity:0}
 if(typeof csv!=="string"||new TextEncoder().encode(csv).length>2_000_000)return {...result,errors:[{line:1,message:'Import exceeds file limit'}]}
 if(!expectedEventId.trim())return {...result,errors:[{line:1,message:'Missing target event'}]}
 let records:string[][]
 try{records=parseCsv(csv)}catch(e){return {...result,errors:[{line:1,message:(e as Error).message}]}}
 const header=['external_id','event_id','quantity','gross_amount','currency','sold_at']
 if(!records.length||records[0].map(x=>x.trim().toLowerCase()).join('|')!==header.join('|'))return {...result,errors:[{line:1,message:'Invalid CSV header'}]}
 if(!Number.isSafeInteger(maxRows)||maxRows<0)return {...result,errors:[{line:1,message:'Invalid row limit'}]}
 if(records.length-1>maxRows)return {...result,errors:[{line:1,message:'Import exceeds row limit'}]}
 const ids=new Set<string>()
 for(let i=1;i<records.length;i++){
  const [externalId,eventId,rawQuantity,rawGross,rawCurrency,rawDate]=records[i].map(x=>x.trim())
  const line=i+1
  if(records[i].length!==6){result.errors.push({line,message:'Incorrect number of columns'});continue}
  if(!externalId||externalId.length>160||/^[=+@\-\t\r]/.test(externalId)||ids.has(externalId)){result.errors.push({line,message:'Missing, oversized or duplicate external ID'});continue}
  if(eventId!==expectedEventId){result.errors.push({line,message:'Event mismatch'});continue}
  const quantity=Number(rawQuantity),grossCents=moneyToCents(rawGross)
  if(!/^\d+$/.test(rawQuantity)||!Number.isSafeInteger(quantity)||quantity<1||quantity>100000||!Number.isSafeInteger(result.quantity+quantity)){result.errors.push({line,message:'Invalid quantity'});continue}
  if(grossCents===null||!Number.isSafeInteger(result.grossCents+grossCents)){result.errors.push({line,message:'Invalid gross amount'});continue}
  if(rawCurrency!=='EUR'){result.errors.push({line,message:'Unsupported currency'});continue}
  const timestamp=Date.parse(rawDate)
  const parts=/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-](\d{2}):(\d{2}))$/.exec(rawDate)
  const calendar=parts?Date.parse(parts[1]+'T00:00:00Z'):NaN
  if(!parts||!Number.isFinite(timestamp)||!Number.isFinite(calendar)||new Date(calendar).toISOString().slice(0,10)!==parts[1]||Number(parts[2])>23||Number(parts[3])>59||Number(parts[4])>59||(parts[6]!==undefined&&(Number(parts[6])>14||Number(parts[7])>59||(Number(parts[6])===14&&Number(parts[7])!==0)))){result.errors.push({line,message:'Invalid timestamp'});continue}
  ids.add(externalId)
  result.rows.push({externalId,eventId,quantity,grossCents,currency:rawCurrency,soldAt:new Date(timestamp).toISOString()})
  result.grossCents+=grossCents;result.quantity+=quantity
 }
 // All-or-nothing: callers must never persist a partial, invalid batch.
 if(!records.slice(1).length)result.errors.push({line:1,message:'No ticket sales rows'})
 if(result.errors.length){result.rows=[];result.grossCents=0;result.quantity=0}
 return result
}
