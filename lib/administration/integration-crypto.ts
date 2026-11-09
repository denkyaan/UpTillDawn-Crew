/** AES-256-GCM with a random IV per save. Ciphertexts are bound to their provider by AAD. */
import type {IntegrationProvider} from "./integration-credentials"
const encoder=new TextEncoder()
const decoder=new TextDecoder("utf-8",{fatal:true})
function bytesFromBase64(value:string):Uint8Array{
 if(!value||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))throw Error("invalid_ciphertext")
 const binary=atob(value)
 return Uint8Array.from(binary,chr=>chr.charCodeAt(0))
}
function bytesToBase64(value:Uint8Array):string{
 let binary=""
 for(const octet of value)binary+=String.fromCharCode(octet)
 return btoa(binary)
}
async function importMasterKey(value:string):Promise<CryptoKey>{
 const bytes=bytesFromBase64(value)
 if(bytes.length!==32)throw Error("integration_master_key_unavailable")
 return crypto.subtle.importKey("raw",bytes.buffer as ArrayBuffer,"AES-GCM",false,["encrypt","decrypt"])
}
export async function sealIntegrationSecrets(provider:IntegrationProvider,secrets:Record<string,string>,base64Key:string):Promise<string>{
 const key=await importMasterKey(base64Key)
 const iv=crypto.getRandomValues(new Uint8Array(12))
 const plain=encoder.encode(JSON.stringify(secrets))
 const data=await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData:encoder.encode("uptilldawn:"+provider+":v1")},key,plain)
 return "v1:"+bytesToBase64(iv)+":"+bytesToBase64(new Uint8Array(data))
}
export async function openIntegrationSecrets(provider:IntegrationProvider,ciphertext:string,base64Key:string):Promise<Record<string,string>>{
 const match=/^v1:([A-Za-z0-9+/=]+):([A-Za-z0-9+/=]+)$/.exec(ciphertext)
 if(!match)throw Error("invalid_ciphertext")
 const iv=bytesFromBase64(match[1]),blob=bytesFromBase64(match[2])
 if(iv.length!==12||blob.length<16||blob.length>16384)throw Error("invalid_ciphertext")
 const key=await importMasterKey(base64Key)
 const data=await crypto.subtle.decrypt({name:"AES-GCM",iv,additionalData:encoder.encode("uptilldawn:"+provider+":v1")},key,blob)
 const json:unknown=JSON.parse(decoder.decode(data))
 if(!json||typeof json!=="object"||Array.isArray(json))throw Error("invalid_ciphertext")
 const record:Record<string,string>={}
 for(const [key,value] of Object.entries(json)){if(typeof value!=="string")throw Error("invalid_ciphertext");record[key]=value}
 return record
}
