// Bounds error telemetry before JSON parsing to prevent memory amplification.
export async function readStrictJson(request:Request,maxBytes=32768):Promise<unknown>{
  const declared=Number(request.headers.get('content-length'))
  if(Number.isFinite(declared)&&declared>maxBytes)throw new Error('too_large')
  const reader=request.body?.getReader()
  if(!reader)throw new Error('invalid_json')
  const chunks:Uint8Array[]=[]
  let total=0
  for(;;){
    const part=await reader.read()
    if(part.done)break
    total+=part.value.byteLength
    if(total>maxBytes){await reader.cancel().catch(()=>{});throw new Error('too_large')}
    chunks.push(part.value)
  }
  const bytes=new Uint8Array(total)
  let offset=0
  for(const part of chunks){bytes.set(part,offset);offset+=part.byteLength}
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}
  catch{throw new Error('invalid_json')}
}
