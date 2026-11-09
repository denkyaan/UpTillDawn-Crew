import {createHash} from 'node:crypto'

/**
 * Read the actual upload bytes once and bind the stored object's bytes to
 * the persisted fingerprint. Hashing the filename, Content-Type, or a 4 KB
 * signature would not provide collision-resistant content deduplication.
 */
export async function financialAttachmentPayload(file:Blob):Promise<{
 bytes:Uint8Array
 sha256:string
}>{
 const bytes=new Uint8Array(await file.arrayBuffer())
 if(bytes.byteLength!==file.size||bytes.byteLength===0||bytes.byteLength>20*1024*1024){
  throw new Error('Invalid financial attachment size')
 }
 return {bytes,sha256:createHash('sha256').update(bytes).digest('hex')}
}
