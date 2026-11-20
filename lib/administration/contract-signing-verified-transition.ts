import "server-only"
import type {ContractSigningState} from "./contract-signing-status"
import {getContractSigningStatus} from "./documenso-envelope"
import {reconcileSigningState} from "./contract-signing-status"

/**
 * A remote status is evidence for a proposed transition, never permission
 * for a browser session to write the signing ledger.
 */
export async function inspectVerifiedSigningTransition(input:{
 persistedEnvelopeId:string
 currentState:ContractSigningState
}):Promise<{
 envelopeId:string
 previous:ContractSigningState
 proposed:ContractSigningState
 changed:boolean
}>{
 if(!/^[a-zA-Z0-9_-]{1,128}$/.test(input.persistedEnvelopeId))throw new Error("Invalid envelope ID")
 const remote=await getContractSigningStatus(input.persistedEnvelopeId)
 if(remote.id!==input.persistedEnvelopeId)throw new Error("Remote envelope identity mismatch")
 const proposed=reconcileSigningState(input.currentState,remote.status)
 return {
  envelopeId:input.persistedEnvelopeId,
  previous:input.currentState,
  proposed,
  changed:proposed!==input.currentState
 }
}
