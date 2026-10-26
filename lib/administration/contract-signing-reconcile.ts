import "server-only"
import {getContractSigningStatus} from "./documenso-envelope"
import {reconcileSigningState,type ContractSigningState} from "./contract-signing-status"

/**
 * Webhook payloads are hints, not evidence. Re-query the remote envelope
 * using the persisted envelope ID before advancing local signing state.
 */
export async function reconcileContractFromNotification(input:{
 persistedEnvelopeId:string
 currentState:ContractSigningState
 notifiedEnvelopeId:string
}):Promise<{envelopeId:string;state:ContractSigningState}>{
 if(input.persistedEnvelopeId!==input.notifiedEnvelopeId){
  throw new Error("Signing notification does not match contract")
 }
 const remote=await getContractSigningStatus(input.persistedEnvelopeId)
 if(remote.id!==input.persistedEnvelopeId)throw new Error("Remote envelope identity mismatch")
 return {
  envelopeId:remote.id,
  state:reconcileSigningState(input.currentState,remote.status)
 }
}
