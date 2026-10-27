import "server-only"
import {getContractSigningStatus} from "./documenso-envelope"
import {reconcileSigningState} from "./contract-signing-status"
import type {SigningLedger,SigningRecord} from "./contract-signing-ledger"

/**
 * Safe retry of an existing signing request. Does not create or send an
 * envelope. Concurrent workers must use conditional database transitions.
 */
export async function retryContractSigningSync(input:{
 record:SigningRecord
 ledger:SigningLedger
}):Promise<{state:SigningRecord["state"];updated:boolean}>{
 const {record,ledger}=input
 if(!record.envelopeId)throw new Error("Signing request has no envelope")
 const current=await ledger.load({documentType:record.documentType,documentId:record.documentId,version:record.version})
 if(!current||current.envelopeId!==record.envelopeId||current.sourceSha256!==record.sourceSha256){
  throw new Error("Signing ledger record changed; reload before synchronization")
 }
 if(current.state!==record.state)throw new Error("Signing state changed; reload before synchronization")
 const remote=await getContractSigningStatus(record.envelopeId)
 if(remote.id!==record.envelopeId)throw new Error("Signing envelope mismatch")
 const next=reconcileSigningState(current.state,remote.status)
 if(next===current.state)return {state:next,updated:false}
 const updated=await ledger.transition({
  envelopeId:current.envelopeId!,expectedState:current.state,nextState:next
 })
 if(!updated)throw new Error("Signing state changed concurrently; retry after reload")
 return {state:next,updated:true}
}
