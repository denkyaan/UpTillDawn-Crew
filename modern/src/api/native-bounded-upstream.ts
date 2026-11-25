/** Shared bounded strict UTF-8 JSON reader for untrusted providers.
 * Caps ACTUAL streamed bytes, not just Content-Length, on Workers Free.
 */
export async function readBoundedUpstreamJson(response:Response,maxBytes:number):Promise<unknown|null>{
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1)return null
 const length=response.headers.get("content-length")
 if(length!==null&&(!/^\d+$/.test(length)||Number(length)>maxBytes))return null
 const reader=response.body?.getReader()
 if(!reader)return null
 const decoder=new TextDecoder("utf-8",{fatal:true})
 let bytes=0,text=""
 try{
  for(;;){
   const {done,value}=await reader.read()
   if(done)break
   bytes+=value.byteLength
   if(bytes>maxBytes){await reader.cancel().catch(()=>{});return null}
   text+=decoder.decode(value,{stream:true})
  }
  text+=decoder.decode()
  return JSON.parse(text) as unknown
 }catch{return null}finally{reader.releaseLock()}
}
