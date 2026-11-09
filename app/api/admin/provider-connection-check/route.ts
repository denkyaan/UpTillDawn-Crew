import {NextResponse} from "next/server"
import {getCurrentUser} from "@/lib/actions/auth"
import {requestHasSameOrigin} from "@/lib/request-origin"
import {checkProviderConnection,type ConnectionProvider} from "@/lib/administration/provider-connection-check"

export const dynamic="force-dynamic"
const fail=(error:string,status:number)=>NextResponse.json({status:"unavailable",error},{status,headers:{"Cache-Control":"no-store"}})
export async function POST(request:Request){
 if(!requestHasSameOrigin(request))return fail("forbidden",403)
 const user=await getCurrentUser()
 if(!user)return fail("unauthorized",401)
 if(!user.approved||user.account_blocked||!((user.realIsAdmin||user.isOwner)))return fail("forbidden",403)
 if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))return fail("unsupported",415)
 // Only accept a tiny allowlisted request body, never raw credentials or URLs.
 const reader=request.body?.getReader()
 if(!reader)return fail("invalid_request",400)
 let size=0;const chunks:Uint8Array[]=[]
 try{
  while(true){
   const part=await reader.read();if(part.done)break
   size+=part.value.byteLength
   if(size>256){await reader.cancel().catch(()=>{});return fail("invalid_request",413)}
   chunks.push(part.value)
  }
 }catch{return fail("invalid_request",400)}
 const buffer=new Uint8Array(size);let off=0
 for(const chunk of chunks){buffer.set(chunk,off);off+=chunk.byteLength}
 let input:unknown
 try{input=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(buffer))}catch{return fail("invalid_request",400)}
 if(!input||typeof input!=="object"||Array.isArray(input))return fail("invalid_request",400)
 const value=(input as {provider?:unknown}).provider
 if(value!=="sumup"&&value!=="documenso"&&value!=="banking")return fail("invalid_provider",422)
 const status=await checkProviderConnection(value as ConnectionProvider)
 // Even a successful credential check is not a completed integration.
 return NextResponse.json({status,scope:"credentials_only"},{headers:{"Cache-Control":"no-store"}})
}
