import {NextResponse} from 'next/server'
import type {SupabaseClient} from '@supabase/supabase-js'
import {administrationAccess,sameOrigin} from '@/lib/administration/access'

export const dynamic='force-dynamic'
const json=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
/** Admin signs off an exact bank ↔ existing payment link, never inserts a financial payment. */
export async function POST(request:Request){
 if(!sameOrigin(request))return json({error:'forbidden'},403)
 const access=await administrationAccess()
 if(!access.ok)return json({error:'access_denied'},access.status)
 let body:unknown
 try{
  if(Number(request.headers.get('content-length')??0)>5000)return json({error:'invalid_payload'},413)
  const raw=await request.text()
  if(raw.length>5000)return json({error:'invalid_payload'},413)
  body=JSON.parse(raw)
 }catch{return json({error:'invalid_payload'},400)}
 if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'invalid_payload'},422)
 const {entryId,paymentId}=body as {entryId?:unknown;paymentId?:unknown}
 if(typeof entryId!=='string'||typeof paymentId!=='string'||!uuid.test(entryId)||!uuid.test(paymentId))
  return json({error:'invalid_reference'},422)
 const db=access.db as unknown as SupabaseClient
 const {data:admin,error:roleError}=await db.rpc('upt_is_admin')
 if(roleError)return json({error:'permission_unavailable'},503)
 if(admin!==true)return json({error:'admin_required'},403)
 const {data,error}=await db.rpc('upt_admin_confirm_bank_payment_match',{p_entry:entryId,p_payment:paymentId})
 if(error)return json({error:error.code==='23505'?'match_conflict':error.code==='42501'?'admin_required':'match_rejected'},
  error.code==='23505'?409:error.code==='42501'?403:422)
 if(typeof data!=='string'||!uuid.test(data))return json({error:'unexpected_result'},503)
 return json({matchId:data})
}
