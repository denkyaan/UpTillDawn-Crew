import {administrationAccess} from '@/lib/administration/access'
import {safeUploadName} from '@/lib/upload-security'

export const dynamic='force-dynamic'
const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}
const respond=(error:string,status:number)=>Response.json({error},{status,headers})

/** Authorize every download under current user permissions before signing a private object. */
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const access=await administrationAccess()
 if(!access.ok)return respond('access_denied',access.status)
 const {id}=await params
 if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))return respond('invalid_attachment',422)
 const {data:attachment,error}=await access.db.from('admin_financial_attachments').select('storage_path,original_name').eq('id',id).maybeSingle()
 if(error)return respond('attachment_lookup_failed',503)
 if(!attachment)return respond('attachment_not_found',404)
 const {data,error:signError}=await access.db.storage.from('admin-financial-attachments').createSignedUrl(attachment.storage_path,60,{download:safeUploadName(attachment.original_name)})
 if(signError||!data?.signedUrl)return respond('attachment_download_failed',503)
 return new Response(null,{status:303,headers:{...headers,Location:data.signedUrl}})
}
