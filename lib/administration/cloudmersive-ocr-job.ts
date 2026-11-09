import {createHmac,timingSafeEqual} from "node:crypto"

/** Never reveal the provider job ID without binding it to its approved user. */
const JOB_RE=/^[A-Za-z0-9_-]{8,160}$/
const VALID_MS=15*60*1000

export function pendingPdfJobId(payload:unknown):string|null{
 if(!payload||typeof payload!=="object"||Array.isArray(payload))return null
 const body=payload as Record<string,unknown>
 return body.AsyncJobStatus==="STARTED"&&typeof body.AsyncJobID==="string"&&JOB_RE.test(body.AsyncJobID)
  ?body.AsyncJobID:null
}

export function signOcrJob(id:string,userId:string,apiKey:string,now=Date.now()):string|null{
 if(!JOB_RE.test(id)||!userId||!apiKey||!Number.isFinite(now))return null
 const payload=Buffer.from(JSON.stringify({id,userId,exp:now+VALID_MS})).toString("base64url")
 const signature=createHmac("sha256",apiKey).update(payload).digest("base64url")
 return payload+"."+signature
}

export function verifyOcrJob(token:string,userId:string,apiKey:string,now=Date.now()):string|null{
 if(typeof token!=="string"||token.length>800||!userId||!apiKey)return null
 const parts=token.split(".")
 if(parts.length!==2||!parts[0]||!/^[A-Za-z0-9_-]{40,64}$/.test(parts[1]))return null
 const expected=createHmac("sha256",apiKey).update(parts[0]).digest()
 let provided:Buffer
 try{provided=Buffer.from(parts[1],"base64url")}catch{return null}
 if(provided.length!==expected.length||!timingSafeEqual(provided,expected))return null
 let parsed:unknown
 try{parsed=JSON.parse(Buffer.from(parts[0],"base64url").toString("utf8"))}catch{return null}
 if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))return null
 const body=parsed as Record<string,unknown>
 if(body.userId!==userId||typeof body.id!=="string"||!JOB_RE.test(body.id))return null
 if(typeof body.exp!=="number"||!Number.isFinite(body.exp)||body.exp<=now||body.exp>now+VALID_MS)return null
 return body.id
}
