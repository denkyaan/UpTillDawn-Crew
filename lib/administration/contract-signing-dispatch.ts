import "server-only"
import type {ContractDocument} from "./contract-document"
import type {SigningRecord,SigningLedger} from "./contract-signing-ledger"
import {checkContractDispatchReadiness} from "./contract-dispatch-readiness"
import {distributeContractSigningDraft,getContractSigningStatus} from "./documenso-envelope"
import {reconcileSigningState} from "./contract-signing-status"

/**
 * Controlled delivery coordinator. This is deliberately NOT a public route:
 * the caller must independently load and authorize an approved immutable
 * contract and archived PDF. The confirmation is required but not sufficient.
 *
 * A remote timeout is ambiguous: never retry distribution blindly. The
 * envelope is polled first to avoid sending duplicate invitations.
 */
export async function dispatchApprovedSigningEnvelope(input:{
 document:ContractDocument
 record:SigningRecord
 pdf:Uint8Array
 recipientEmail:string
 ledger:SigningLedger
 confirmedByOperator:boolean
}):Promise<"sent"|"already_sent">{
 if(input.confirmedByOperator!==true)throw new Error("Explicit dispatch confirmation required")
 const latest=await input.ledger.load({
  documentType:input.record.documentType,
  documentId:input.record.documentId,version:input.record.version
 })
 if(!latest||latest.sourceSha256!==input.record.sourceSha256||
  latest.envelopeId!==input.record.envelopeId)throw new Error("Signing ledger changed; reload")
 if(latest.state==="sent"){
  if(!latest.envelopeId)throw new Error("Sent signing record has no envelope")
  const remoteSent=await getContractSigningStatus(latest.envelopeId)
  if(remoteSent.id!==latest.envelopeId||remoteSent.status!=="PENDING")throw new Error("Remote signing status needs reconciliation")
  return "already_sent"
 }
 const readiness=await checkContractDispatchReadiness({
  document:input.document,record:latest,pdf:input.pdf,recipientEmail:input.recipientEmail
 })
 if(!readiness.ready)throw new Error("Signing dispatch blocked: "+readiness.blockers.join(","))
 const envelopeId=latest.envelopeId
 if(!envelopeId)throw new Error("Missing signing envelope")
 const remote=await getContractSigningStatus(envelopeId)
 if(remote.id!==envelopeId)throw new Error("Remote envelope identity mismatch")
 const state=reconcileSigningState(latest.state,remote.status)
 if(state==="sent"){
  const reconciled=await input.ledger.transition({envelopeId,expectedState:"draft",nextState:"sent"})
  if(!reconciled)throw new Error("Signing ledger conflict; reload before retry")
  return "already_sent"
 }
 if(state!=="draft")throw new Error("Signing envelope is no longer dispatchable")
 // Delivery is not automatically retried after a remote error.
 await distributeContractSigningDraft({envelopeId,dispatchApproved:true})
 const changed=await input.ledger.transition({
  envelopeId,expectedState:"draft",nextState:"sent"
 })
 if(!changed)throw new Error("Invitation sent but ledger update failed; reconcile before retrying")
 return "sent"
}
