import "server-only"
import type {ContractSigningState} from "./contract-signing-status"

/**
 * Persistence port. Implementations must use a transaction or conditional
 * update (expected previous state + envelope ID) and reject stale writes.
 * No direct client-side database mutation is permitted.
 */
export type SigningRecord={
 documentType:"artist"|"staff"
 documentId:string
 version:number
 sourceSha256:string
 envelopeId:string|null
 state:ContractSigningState
 signedPdfPath:string|null
}
export type SigningLedger={
 load(input:{documentType:"artist"|"staff";documentId:string;version:number}):Promise<SigningRecord|null>
 attachEnvelope(input:{documentType:"artist"|"staff";documentId:string;version:number;sourceSha256:string;envelopeId:string}):Promise<void>
 transition(input:{envelopeId:string;expectedState:ContractSigningState;nextState:ContractSigningState}):Promise<boolean>
 recordSignedPdf(input:{envelopeId:string;path:string}):Promise<boolean>
}
export async function advanceSigningLedger(input:{
 ledger:SigningLedger
 envelopeId:string
 expectedState:ContractSigningState
 nextState:ContractSigningState
}):Promise<void>{
 if(input.expectedState===input.nextState)return
 const changed=await input.ledger.transition({
  envelopeId:input.envelopeId,expectedState:input.expectedState,nextState:input.nextState
 })
 if(!changed)throw new Error("Signing ledger conflict; reload current state")
}
