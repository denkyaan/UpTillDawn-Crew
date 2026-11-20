import "server-only"
import {authorizedSigningLedger} from "./contract-signing-supabase"
import {getContractSigningStatus} from "./documenso-envelope"
import {reconcileSigningState} from "./contract-signing-status"
import type {ContractArchiveDocumentType} from "./contract-archive"

/**
 * Read-only refresh until verified backend ledger transitions are deployed.
 * Never writes remote statuses using an end-user Supabase session.
 */
export async function refreshContractSigningStatus(input:{
 documentType:ContractArchiveDocumentType
 documentId:string
 version:number
}):Promise<{state:string;remoteState:string;requiresReconciliation:boolean}>{
 const ledger=await authorizedSigningLedger()
 const record=await ledger.load(input)
 if(!record)throw new Error("Signing request not accessible")
 if(!record.envelopeId)throw new Error("Signing envelope not yet created")
 const remote=await getContractSigningStatus(record.envelopeId)
 if(remote.id!==record.envelopeId)throw new Error("Remote envelope identity mismatch")
 const next=reconcileSigningState(record.state,remote.status)
 return {state:record.state,remoteState:next,requiresReconciliation:next!==record.state}
}
