// Native Administration secure document reads and Peppol XML preparation.
// Original source: app/api/administration/finance/attachments/[id]/route.ts
// and app/api/administration/peppol/prepare/route.ts. Both routes must be
// authenticated by sourceReadSession BEFORE calling these functions.
import type {SupabaseClient} from "@supabase/supabase-js"
import {safeUploadName} from "../../../lib/upload-security.ts"
import {readStrictJson} from "../../../lib/strict-json-body.ts"
import {loadPeppolPreparation} from "./native-peppol-loader.ts"

export const secureHeaders={
 "Cache-Control":"private, no-store","Referrer-Policy":"no-referrer",
 "X-Content-Type-Options":"nosniff"
} as const
const error=(code:string,status:number)=>Response.json({error:code},{
 status,headers:secureHeaders
})
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
export function sameOriginMutation(request:Request){
 const origin=request.headers.get("origin"),site=request.headers.get("sec-fetch-site")
 return site!=="cross-site"&&origin===new URL(request.url).origin&&
  (site===null||site==="same-origin"||site==="none")
}
export async function nativeAdministrationPermission(db:SupabaseClient){
 try{
  const {data,error:rpcError}=await db.rpc("upt_can_manage_administration")
  return rpcError?503:data===true?200:403
 }catch{return 503}
}
export async function nativeFinancialAttachment(
 db:SupabaseClient,id:string
):Promise<Response>{
 if(!uuid.test(id))return error("invalid_attachment",422)
 try{
  const {data:attachment,error:lookupError}=await db.from("admin_financial_attachments")
   .select("storage_path,original_name").eq("id",id).maybeSingle()
  if(lookupError)return error("attachment_lookup_failed",503)
  if(!attachment)return error("attachment_not_found",404)
  const {data:scan,error:scanError}=await db.from("upload_security_scans")
   .select("status").eq("bucket_id","admin-financial-attachments")
   .eq("storage_path",attachment.storage_path).maybeSingle()
  if(scanError)return error("scan_status_unavailable",503)
  if(scan?.status==="infected"||scan?.status==="suspicious")
   return error("attachment_blocked",410)
  if(scan?.status!=="clean")return error("attachment_awaiting_security_scan",423)
  const {data,error:signError}=await db.storage.from("admin-financial-attachments")
   .createSignedUrl(attachment.storage_path,60,{
    download:safeUploadName(attachment.original_name)
   })
  if(signError||!data?.signedUrl)return error("attachment_download_failed",503)
  // Private storage alone signs the URL, only after metadata/scan/RLS agree.
  return new Response(null,{status:303,headers:{...secureHeaders,Location:data.signedUrl}})
 }catch{return error("attachment_download_failed",503)}
}
export async function nativePeppolPreparation(
 db:SupabaseClient,request:Request,download:boolean
):Promise<Response>{
 const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"} as const
 const denied=(code:string,status:number)=>Response.json({error:code},{status,headers})
 if(download&&!sameOriginMutation(request))return denied("forbidden",403)
 let id:string
 if(download){
  if(!(request.headers.get("content-type")||"").toLowerCase().startsWith("application/json"))
   return denied("invalid_document",400)
  let body:unknown
  try{body=await readStrictJson(request,8192)}
  catch{return denied("invalid_document",400)}
  id=String(body&&typeof body==="object"&&!Array.isArray(body)?
   (body as {documentId?:unknown}).documentId??"":"")
 }else id=new URL(request.url).searchParams.get("documentId")??""
 if(!uuid.test(id))return denied("invalid_document",400)
 try{
  const prepared=await loadPeppolPreparation(db,id)
  if(prepared.error)return denied(prepared.error,prepared.error==="not_found"?404:503)
  if(!download||!prepared.xml)return Response.json({
   document:prepared.document,ready:Boolean(prepared.xml),issues:prepared.issues
  },{status:download?422:200,headers})
  const filename="peppol-"+String(prepared.document.number??id)
   .replace(/[^a-zA-Z0-9._-]/g,"_").slice(0,80)+".xml"
  return new Response(prepared.xml,{headers:{
   ...headers,"Content-Type":"application/xml; charset=utf-8",
   "Content-Disposition":'attachment; filename="'+filename+'"'
  }})
 }catch{return denied("unavailable",503)}
}
