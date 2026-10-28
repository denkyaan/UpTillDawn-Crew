/**
 * Private contract archive object naming.
 *
 * Only a server-side storage client with explicit administration authorization
 * may use these paths. Never expose this bucket through public URLs.
 */
export const CONTRACT_ARCHIVE_BUCKET="administration-contracts" as const
export type ContractArchiveKind="draft"|"signed"|"evidence"
export type ContractArchiveDocumentType="artist"|"staff"
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const digest=/^[a-f0-9]{64}$/
export function contractArchivePath(input:{
 documentType:ContractArchiveDocumentType
 documentId:string
 version:number
 kind:ContractArchiveKind
 sha256:string
}):string{
 if(!uuid.test(input.documentId))throw new Error("Invalid contract document ID")
 if(!Number.isSafeInteger(input.version)||input.version<1)throw new Error("Invalid contract version")
 if(!digest.test(input.sha256))throw new Error("Invalid contract digest")
 if(!["artist","staff"].includes(input.documentType)||!["draft","signed","evidence"].includes(input.kind))throw new Error("Invalid contract archive category")
 const extension=input.kind==="evidence"?"json":"pdf"
 return [input.documentType,input.documentId,"v"+input.version,input.kind+"-"+input.sha256+"."+extension].join("/")
}
export function isContractArchivePath(path:string):boolean{
 const parts=path.split("/")
 if(parts.length!==4)return false
 const [documentType,documentId,version,file]=parts
 if(documentType!=="artist"&&documentType!=="staff")return false
 if(!uuid.test(documentId)||!/^v[1-9][0-9]*$/.test(version))return false
 return /^(draft|signed)-[a-f0-9]{64}\.pdf$/.test(file)||/^evidence-[a-f0-9]{64}\.json$/.test(file)
}
