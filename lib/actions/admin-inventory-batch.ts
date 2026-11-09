'use server'

import {revalidatePath} from 'next/cache'
import {administrationAccess} from '@/lib/administration/access'

export type BulkReceiptState={ok:boolean;count:number;error:string|null}
const invalid:BulkReceiptState={ok:false,count:0,error:'invalid'}
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i

export async function receiveAdminInventoryBatch(
 _previous:BulkReceiptState,
 form:FormData,
):Promise<BulkReceiptState>{
 const access=await administrationAccess()
 if(!access.ok || (!access.user.realIsAdmin && !access.user.isOwner))
  return {ok:false,count:0,error:'denied'}

 const request=String(form.get('request')??'')
 const document=String(form.get('document')??'')
 const raw=String(form.get('rows')??'')
 const confirmed=form.get('confirm')==='yes'
 if(!confirmed||!uuid.test(request)||!uuid.test(document)||raw.length>16000)
  return invalid
 let rows:unknown
 try{rows=JSON.parse(raw)}catch{return invalid}
 if(!Array.isArray(rows)||rows.length<1||rows.length>50)return invalid
 const seen=new Set<string>()
 for(const row of rows){
  if(!row||typeof row!=='object'||Array.isArray(row)||
   typeof row.line!=='string'||typeof row.item!=='string'||
   !uuid.test(row.line)||!uuid.test(row.item)||
   !Number.isSafeInteger(row.quantity)||row.quantity<1||row.quantity>100000||
   seen.has(row.line))return invalid
  seen.add(row.line)
 }
 const {data,error}=await access.db.rpc('upt_admin_receive_inventory_batch' as never,{
  p_request:request,p_document:document,p_rows:rows,
 } as never)
 if(error||typeof data!=='number'||data<1||data>50)
  return {ok:false,count:0,error:'rejected'}
 revalidatePath('/portals/administration/modules/inventory')
 return {ok:true,count:data,error:null}
}
