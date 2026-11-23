// Shared isolated God Mode mutation boundary. Original Main and Production
// are not modified. Each route also has the outer signed SSR guard in Hono.
import {parseCookieHeader} from "@supabase/ssr"
import type {SupabaseClient} from "@supabase/supabase-js"
import {readStrictJson} from "../../../lib/strict-json-body.ts"

const QA_DB="https://npbjrtiolqperdgljnhi.supabase.co"
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"} as const
export const makerJson=(data:unknown,status=200)=>Response.json(data,{status,headers})
export class MakerExecutionError extends Error{
 constructor(message:string,readonly status=400){super(message)}
}
export function makerError(error:unknown){
 if(error instanceof MakerExecutionError)return makerJson({error:error.message},error.status)
 return makerJson({error:"De actie kon niet worden voltooid. Vernieuw de status voordat je opnieuw opslaat."},503)
}
export async function makerAuthorization(
 db:Pick<SupabaseClient,"rpc">,request:Request,cookieHeader:string,env:{SUPABASE_URL:string}
):Promise<string>{
 if(env.SUPABASE_URL!==QA_DB)throw new MakerExecutionError("Onbekende Maker-omgeving.",503)
 const u=new URL(request.url)
 const origin=request.headers.get("origin"),site=request.headers.get("sec-fetch-site")
 if(site==="cross-site"||(origin!==null&&origin!==u.origin))
  throw new MakerExecutionError("Ongeldige oorsprong.",403)
 const token=parseCookieHeader(cookieHeader).find(x=>x.name==="uptilldawn-god-session")?.value
 if(!token)throw new MakerExecutionError("Meld opnieuw aan bij God Mode.",401)
 const {data,error}=await db.rpc("upt_god_session_valid",{p_token:token})
 if(error||data!==true)throw new MakerExecutionError("God Mode sessie verlopen.",401)
 return token
}
export async function makerRequestBody(request:Request,limit=32_768):Promise<unknown>{
 if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
  throw new MakerExecutionError("Ongeldige aanvraag.",415)
 try{return await readStrictJson(request,limit)}
 catch(error){
  throw new MakerExecutionError("Ongeldige aanvraag.",
   error instanceof Error&&error.message==="too_large"?413:400)
 }
}
export type MakerAI={run:(model:string,input:Record<string,unknown>)=>Promise<unknown>}
export function parseModelReply(raw:unknown):unknown{
 const r=(raw as {response?:unknown}|null)?.response
 if(typeof r!=="string")return r
 try{return JSON.parse(r)}catch{return null}
}
