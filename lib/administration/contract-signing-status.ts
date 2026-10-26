import "server-only"
import {getContractSigningStatus} from "./documenso-envelope"

/**
 * Polling reconciliation intentionally treats Documenso as a remote source,
 * not as authorization to overwrite local contract records.
 * The caller must persist transitions with an idempotent database transaction.
 */
export type ContractSigningState="draft"|"sent"|"completed"|"rejected"|"cancelled"
export function reconcileSigningState(current:ContractSigningState,remote:string):ContractSigningState{
 const transitions:Record<ContractSigningState,readonly string[]>={
  draft:["DRAFT","PENDING","COMPLETED","REJECTED","CANCELLED"],
  sent:["PENDING","COMPLETED","REJECTED","CANCELLED"],
  completed:["COMPLETED"],
  rejected:["REJECTED"],
  cancelled:["CANCELLED"]
 }
 if(!transitions[current].includes(remote))throw new Error("Unexpected signing state transition")
 const map:Record<string,ContractSigningState>={
  DRAFT:"draft",PENDING:"sent",COMPLETED:"completed",REJECTED:"rejected",CANCELLED:"cancelled"
 }
 return map[remote]
}
export async function checkContractSigningState(input:{
 envelopeId:string
 current:ContractSigningState
}):Promise<ContractSigningState>{
 const remote=await getContractSigningStatus(input.envelopeId)
 if(remote.id!==input.envelopeId)throw new Error("Remote signing envelope identity mismatch")
 return reconcileSigningState(input.current,remote.status)
}
