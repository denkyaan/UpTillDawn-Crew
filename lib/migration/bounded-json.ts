export async function boundedMigrationJson(request:Request,limit=8192):Promise<unknown>{
 if(!(request.headers.get('content-type')||'').startsWith('application/json'))throw Error('invalid_content_type')
 const reader=request.body?.getReader()
 if(!reader)throw Error('invalid_body')
 const decoder=new TextDecoder(),chunks:string[]=[]
 let size=0
 try{
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel().catch(()=>{});throw Error('too_large')}chunks.push(decoder.decode(value,{stream:true}))}
 }finally{reader.releaseLock()}
 chunks.push(decoder.decode())
 return JSON.parse(chunks.join(''))
}
