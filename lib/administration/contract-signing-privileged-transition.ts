import "server-only"
import {createClient as createSupabaseClient} from "@supabase/supabase-js"
import {authorizedContractStorage} from "./contract-archive-access"
import type {ContractSigningState} from "./contract-signing-status"

/**
 * Privileged signing mutations are only callable from trusted server code.
 * Browser sessions never receive the service-role credential.
 * Remote Documenso evidence must be verified by the caller first.
 */
export async function transitionVerifiedSigningState(input:{
 envelopeId:string
 expectedState:ContractSigningState
 nextState:ContractSigningState
 remoteEvidenceVerified:boolean
}):Promise<boolean>{
 if(input.remoteEvidenceVerified!==true)throw new Error("Verified remote signing evidence required")
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(input.envelopeId))throw new Error("Invalid signing envelope")
 const allowed:Record<ContractSigningState,readonly ContractSigningState[]>={
  draft:["sent","completed","rejected","cancelled"],
  sent:["completed","rejected","cancelled"],
  completed:[],rejected:[],cancelled:[]
 }
 if(!allowed[input.expectedState].includes(input.nextState))throw new Error("Invalid signing transition")
 await authorizedContractStorage()
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL
 const secret=process.env.SUPABASE_SERVICE_ROLE_KEY
 if(!url||!secret||!url.startsWith("https://"))throw new Error("Privileged signing backend not configured")
 const db=createSupabaseClient(url,secret,{
  auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}
 })
 const {data,error}=await db.rpc("upt_server_transition_contract_signing" as never,{
  p_envelope_id:input.envelopeId,
  p_expected_status:input.expectedState,
  p_next_status:input.nextState
 } as never)
 if(error)throw new Error("Signing ledger transition rejected")
 return data===true
}
