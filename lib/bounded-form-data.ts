/**
 * Parse tiny, public login forms without trusting Content-Length.
 * A streamed body may omit the header or exceed a declared size.
 * Stop consuming before multipart parsing and credential processing.
 */
export async function readBoundedFormData(request:Request,maxBytes=16_384):Promise<FormData>{
 const type=request.headers.get('content-type')||''
 if(!type.toLowerCase().startsWith('multipart/form-data;'))throw new Error('invalid_form')
 const declared=request.headers.get('content-length')
 if(declared!==null){
  const length=Number(declared)
  if(!Number.isSafeInteger(length)||length<0)throw new Error('invalid_form')
  if(length>maxBytes)throw new Error('too_large')
 }
 const reader=request.body?.getReader()
 if(!reader)throw new Error('invalid_form')
 const chunks:Uint8Array[]=[]
 let total=0
 try{
  for(;;){
   const part=await reader.read()
   if(part.done)break
   total+=part.value.byteLength
   if(total>maxBytes){
    await reader.cancel().catch(()=>{})
    throw new Error('too_large')
   }
   chunks.push(part.value)
  }
 }finally{reader.releaseLock()}
 const bytes=new Uint8Array(total)
 let offset=0
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
 try{
  // Only copy the required parser header; never forward request credentials,
  // cookies or attacker-controlled forwarding headers into the synthetic parser.
  return await new Request(request.url,{
   method:'POST',headers:{'content-type':type},body:bytes,
  }).formData()
 }catch{throw new Error('invalid_form')}
}
