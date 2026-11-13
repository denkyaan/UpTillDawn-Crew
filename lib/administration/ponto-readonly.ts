import "server-only"
import {normalizePontoTransactions,type PontoImportPage} from "./ponto-import"

const host="https://api.myponto.com"
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const apiTimeout=8000

async function boundedJson(response:Response,limit:number):Promise<unknown>{
 if(!response.ok)throw Error(response.status===401||response.status===403?"ponto_unauthorized":"ponto_unavailable")
 if(!/^(?:application\/json|application\/vnd\.api\+json)(?:\s*;|$)/i.test(response.headers.get("content-type")??""))
  throw Error("ponto_invalid_content")
 const declared=response.headers.get("content-length")
 if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>limit))throw Error("ponto_response_too_large")
 const stream=response.body
 if(!stream)throw Error("ponto_invalid_content")
 const reader=stream.getReader(),chunks:Uint8Array[]=[]
 let length=0
 try{
  while(true){
   const {done,value}=await reader.read()
   if(done)break
   length+=value.byteLength
   if(length>limit){await reader.cancel().catch(()=>{});throw Error("ponto_response_too_large")}
   chunks.push(value)
  }
 }finally{reader.releaseLock()}
 const bytes=new Uint8Array(length)
 let offset=0
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
 try{return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes)) as unknown}
 catch{throw Error("ponto_invalid_content")}
}
async function request(url:URL,init:RequestInit,limit:number):Promise<unknown>{
 // Restrict every provider request to preconstructed HTTPS Ponto API origins.
 if(url.origin!==host||url.username||url.password)throw Error("ponto_invalid_url")
 try{
  return await boundedJson(await fetch(url,{...init,redirect:"error",cache:"no-store",signal:AbortSignal.timeout(apiTimeout)}),limit)
 }catch(error){if(error instanceof Error&&error.message.startsWith("ponto_"))throw error;throw Error("ponto_unavailable")}
}
export async function pontoAccessToken(config:Record<string,string|undefined>):Promise<string>{
 const id=config.PONTO_CLIENT_ID,secret=config.PONTO_CLIENT_SECRET
 if(!id||!secret||id.length>256||secret.length>1024)throw Error("ponto_not_configured")
 const url=new URL("/oauth2/token",host)
 const token=await request(url,{
  method:"POST",
  headers:{"Authorization":"Basic "+Buffer.from(id+":"+secret).toString("base64"),
   "Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"},
  body:"grant_type=client_credentials"
 },8192)
 if(!token||typeof token!=="object"||Array.isArray(token)||!("access_token" in token)||
    typeof token.access_token!=="string"||token.access_token.length<11||token.access_token.length>4096||
    /[\u0000-\u0020\u007f]/.test(token.access_token)||!("scope" in token)||
    typeof token.scope!=="string"||!token.scope.split(" ").includes("ai"))throw Error("ponto_unauthorized")
 return token.access_token
}
async function readApi(path:string,token:string,limit:number){
 return request(new URL(path,host),{
  method:"GET",headers:{"Authorization":"Bearer "+token,"Accept":"application/json"}
 },limit)
}
/** IDs only, no IBAN, balance, customer name, or bank account metadata. */
export async function pontoAuthorizedAccounts(token:string):Promise<string[]>{
 const body=await readApi("/accounts?page%5Blimit%5D=100",token,131072)
 if(!body||typeof body!=="object"||Array.isArray(body)||!("data" in body)||!Array.isArray(body.data)||body.data.length>100)
  throw Error("ponto_invalid_accounts")
 const accounts:string[]=[]
 for(const raw of body.data){
  if(!raw||typeof raw!=="object"||raw.type!=="account"||typeof raw.id!=="string"||!uuid.test(raw.id)||accounts.includes(raw.id))
   throw Error("ponto_invalid_accounts")
  accounts.push(raw.id)
 }
 return accounts
}
/** One bounded provider page of BOOKED movements. Cursor supplied only as an
 * opaque validated UUID, never as an arbitrary provider URL. No sync job starts.
 */
export async function pontoBookedPage(token:string,accountId:string,after:string|null):Promise<PontoImportPage>{
 if(!uuid.test(accountId)||(after!==null&&!uuid.test(after)))throw Error("ponto_invalid_request")
 const path="/accounts/"+accountId+"/transactions?page%5Blimit%5D=100"+
  (after?"&page%5Bafter%5D="+after:"")
 const data=await readApi(path,token,524288)
 return normalizePontoTransactions(data,accountId)
}
