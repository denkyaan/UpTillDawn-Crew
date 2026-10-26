import "server-only"
import {authorizedSigningLedger} from "./contract-signing-supabase"
import {retryContractSigningSync} from "./contract-signing-retry"
import type {ContractArchiveDocumentType} from "./contract-archive"

/** Authenticated manual status refresh; never creates or sends envelopes. */
export async function refreshContractSigningStatus(input:{
 documentType:ContractArchiveDocumentType
 documentId:string
 version:number
}){
 const ledger=await authorizedSigningLedger()
 const record=await ledger.load(input)
 if(!record)throw new Error("Signing request not accessible")
 return retryContractSigningSync({record,ledger})
}
