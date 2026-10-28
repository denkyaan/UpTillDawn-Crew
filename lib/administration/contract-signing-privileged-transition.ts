import "server-only"
import {authorizedContractStorage} from "./contract-archive-access"
import type {ContractSigningState} from "./contract-signing-status"

/**
 * The application runtime must not hold a service-role credential.
 * A separately authenticated, isolated signing worker is required to
 * execute privileged ledger transitions after validating remote evidence.
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
 throw new Error("Signing transitions require an isolated privileged worker")
}
