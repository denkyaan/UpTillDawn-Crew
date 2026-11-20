/** Native streamed multipart parsing with a byte cap. Avoid retaining a second
 * concatenated copy of large attachments alongside the parsed File objects. */
export async function boundedMigrationForm(request:Request,limit=22*1024*1024):Promise<FormData>{
 const type=request.headers.get('content-type')||''
 if(!type.startsWith('multipart/form-data;')||!request.body)throw Error('invalid_form')
 const declared=request.headers.get('content-length')
 if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>limit))throw Error('too_large')
 let size=0
 const body=request.body.pipeThrough(new TransformStream<Uint8Array,Uint8Array>({transform(chunk,controller){
  size+=chunk.byteLength
  if(size>limit)throw Error('too_large')
  controller.enqueue(chunk)
 }}))
 return new Request(request.url,{method:'POST',headers:{'content-type':type},body,...{duplex:'half'}}).formData()
}
