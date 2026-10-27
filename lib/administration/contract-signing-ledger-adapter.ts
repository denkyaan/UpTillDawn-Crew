import "server-only"
import type {SigningLedger,SigningRecord} from "./contract-signing-ledger"
import type {ContractSigningState} from "./contract-signing-status"

/** Adapter for an independently authorized, transaction-capable ledger store.
 * The database must enforce uniqueness and conditional updates.
 */
export type SigningLedgerStore={
 find(documentType:"artist"|"staff",documentId:string,version:number):Promise<SigningRecord|null>
 attach(input:{documentType:"artist"|"staff";documentId:string;version:number;sourceSha256:string;envelopeId:string}):Promise<number>
 change(input:{envelopeId:string;expectedState:ContractSigningState;nextState:ContractSigningState}):Promise<number>
 saveSignedPdf(envelopeId:string,path:string):Promise<number>
}
export function createSigningLedger(store:SigningLedgerStore):SigningLedger{
 return {
  load:({documentType,documentId,version})=>store.find(documentType,documentId,version),
  async attachEnvelope(input){
   if(!/^[a-zA-Z0-9_-]{1,128}$/.test(input.envelopeId)||!/^[a-f0-9]{64}$/.test(input.sourceSha256))throw new Error("Invalid envelope attachment")
   const changed=await store.attach(input)
   if(changed!==1)throw new Error("Signing envelope already attached or contract not approved")
  },
  async transition(input){
   if(!/^[a-zA-Z0-9_-]{1,128}$/.test(input.envelopeId))throw new Error("Invalid signing envelope")
   const allowed:Record<ContractSigningState,readonly ContractSigningState[]>={
    draft:["sent","completed","rejected","cancelled"],
    sent:["completed","rejected","cancelled"],
    completed:[],rejected:[],cancelled:[]
   }
   if(!allowed[input.expectedState]?.includes(input.nextState))throw new Error("Invalid signing ledger transition")
   const changed=await store.change(input)
   if(changed>1)throw new Error("Unexpected signing ledger mutation count")
   return changed===1
  },
  async recordSignedPdf({envelopeId,path}){
   if(!/^[a-zA-Z0-9_-]{1,128}$/.test(envelopeId))throw new Error("Invalid signing envelope")
   if(!/^(artist|staff)\/[0-9a-f-]{36}\/v[1-9][0-9]*\/signed-[a-f0-9]{64}\.pdf$/.test(path)){
    throw new Error("Invalid signed contract archive path")
   }
   const changed=await store.saveSignedPdf(envelopeId,path)
   if(changed>1)throw new Error("Unexpected signed archive mutation count")
   return changed===1
  }
 }
}
