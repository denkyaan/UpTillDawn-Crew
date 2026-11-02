import "server-only"
import type {ContractArchiveDocumentType} from "./contract-archive"
import {generateAndArchiveContract,type ContractPdfRenderer} from "./contract-generation-pipeline"
import type {ContractDocument} from "./contract-document"
import type {ArchiveStorageClient} from "./contract-archive-server"

/** Narrow read-only database adapter. Use a server-side authenticated Supabase client.
 * This helper never grants storage access or bypasses RLS.
 */
export type ApprovedArtistVersionReader={
 from(table:"admin_artist_agreement_versions"):{
  select(columns:"id,version_number,approved_at"):{
   eq(column:"id",value:string):{
    eq(column:"version_number",value:number):{
     maybeSingle():Promise<{data:{id:string;version_number:number;approved_at:string|null}|null;error:unknown}>
    }
   }
  }
 }
}

export function createApprovedArtistVersionVerifier(client:ApprovedArtistVersionReader){
 return async (identity:{
  documentType:ContractArchiveDocumentType
  documentId:string
  version:number
  approvedAt:string
 }):Promise<boolean>=>{
  if(identity.documentType!=="artist")return false
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identity.documentId))return false
  if(!Number.isSafeInteger(identity.version)||identity.version<1)return false
  const requested=Date.parse(identity.approvedAt)
  if(!Number.isFinite(requested)||requested>Date.now()+60_000)return false
  const {data,error}=await client.from("admin_artist_agreement_versions")
   .select("id,version_number,approved_at")
   .eq("id",identity.documentId)
   .eq("version_number",identity.version)
   .maybeSingle()
  if(error||!data||!data.approved_at)return false
  const stored=Date.parse(data.approved_at)
  return data.id.toLowerCase()===identity.documentId.toLowerCase()&&
   data.version_number===identity.version&&
   Number.isFinite(stored)&&stored===requested&&stored<=Date.now()+60_000
 }
}

/** Artist-only entry point: checks the persisted approved version before any rendering or storage write. */
export async function generateAndArchiveApprovedArtistContract(input:{
 document:ContractDocument
 documentId:string
 version:number
 renderer:ContractPdfRenderer
 storageClient:ArchiveStorageClient
 approvalClient:ApprovedArtistVersionReader
}){
 return generateAndArchiveContract({
  document:input.document,
  documentType:"artist",
  documentId:input.documentId,
  version:input.version,
  renderer:input.renderer,
  client:input.storageClient,
  assertApprovedVersion:createApprovedArtistVersionVerifier(input.approvalClient)
 })
}
