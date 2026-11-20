import {administrationAccess,sameOrigin} from '@/lib/administration/access'
import {loadPeppolPreparation} from '@/lib/administration/peppol-server'
import type {SupabaseClient} from '@supabase/supabase-js'

export const dynamic='force-dynamic'
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}
async function prepare(request:Request,download:boolean){
 if(download&&!sameOrigin(request))return Response.json({error:'forbidden'},{status:403,headers})
 const access=await administrationAccess()
 if(!access.ok)return Response.json({error:'access_denied'},{status:access.status,headers})
 const body=download?await request.json().catch(()=>null):null
 const id=String(download?body?.documentId??'':new URL(request.url).searchParams.get('documentId')??'')
 if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))return Response.json({error:'invalid_document'},{status:400,headers})
 const result=await loadPeppolPreparation(access.db as unknown as SupabaseClient,id)
 if(result.error)return Response.json({error:result.error},{status:result.error==='not_found'?404:503,headers})
 if(!download||!result.xml)return Response.json({document:result.document,ready:Boolean(result.xml),issues:result.issues},{status:download?422:200,headers})
 const filename='peppol-'+String(result.document.number??id).replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,80)+'.xml'
 return new Response(result.xml,{headers:{...headers,'Content-Type':'application/xml; charset=utf-8','Content-Disposition':`attachment; filename="${filename}"`}})
}
export async function GET(request:Request){return prepare(request,false)}
export async function POST(request:Request){return prepare(request,true)}
