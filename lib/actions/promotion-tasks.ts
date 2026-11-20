'use server'

import {revalidatePath} from 'next/cache'
import {redirect} from 'next/navigation'
import {getCurrentUser} from '@/lib/actions/auth'
import {createClient} from '@/lib/supabase/crew-server'
import {listPage} from '@/lib/list-query'

const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
async function adminClient(){
 const actor=await getCurrentUser()
 if(!actor||(!actor.realIsAdmin&&!actor.isOwner)||(!actor.approved&&!actor.isOwner)||(actor.account_blocked&&!actor.isOwner))throw new Error('Geen toegang.')
 return createClient()
}
function result(form:FormData,error?:string):never{
 const base=form.get('admin_view')==='1'?'/admin/management/promotion-tasks':'/portals/administration/promotion-tasks'
 const q=String(form.get('return_q')??'').trim().slice(0,100)
 const scope=String(form.get('return_scope')??'')
 const page=listPage(String(form.get('return_page')??''),99999)
 const params=new URLSearchParams({...(q?{q}:{}),...(['general','event'].includes(scope)?{scope}:{}),...(page>1?{page:String(page)}:{}),...(error?{action_error:error}:{saved:'1'})})
 revalidatePath('/admin/management/promotion-tasks')
 revalidatePath('/portals/administration/promotion-tasks')
 revalidatePath('/portals/promotion/tasks')
 redirect(base+'?'+params)
}
export async function createPromotionTask(form:FormData){
 const db=await adminClient()
 const request=String(form.get('request')??'')
 const title=String(form.get('title')??'').trim(),description=String(form.get('description')??'')
 const users=[...new Set(form.getAll('user_id').map(String))]
 if(!uuid.test(request)||!title||title.length>200||description.length>4000||!users.length||users.length>100||users.some(id=>!uuid.test(id)))result(form,'invalid')
 const {error}=await db.rpc('upt_admin_create_promotion_task',{p_request:request,p_title:title,p_description:description,p_users:users})
 result(form,error?'save':undefined)
}
export async function assignGeneralPromotionTask(form:FormData){
 const db=await adminClient()
 const task=String(form.get('task_id')??''),user=String(form.get('user_id')??'')
 if(!uuid.test(task)||!uuid.test(user))result(form,'invalid')
 const {error}=await db.rpc('upt_admin_assign_promotion_task',{p_task:task,p_user:user})
 result(form,error?'save':undefined)
}
export async function editPromotionTask(form:FormData){
 const db=await adminClient()
 const task=String(form.get('task_id')??''),expected=String(form.get('expected_updated_at')??'')
 const title=String(form.get('title')??'').trim(),description=String(form.get('description')??'')
 if(!uuid.test(task)||!title||title.length>200||description.length>4000||!expected||!Number.isFinite(Date.parse(expected)))result(form,'invalid')
 const {error}=await db.rpc('upt_admin_update_promotion_task',{p_task:task,p_title:title,p_description:description,p_expected_updated_at:expected})
 result(form,error?.code==='40001'?'conflict':error?'save':undefined)
}
export async function removeGeneralPromotionAssignment(form:FormData){
 const db=await adminClient()
 const id=String(form.get('assignment_id')??'')
 if(!uuid.test(id))result(form,'invalid')
 const {data,error:lookupError}=await db.from('task_assignments').select('tasks(promotion_only,event_id)').eq('id',id).maybeSingle()
 if(lookupError||!data?.tasks?.promotion_only||data.tasks.event_id!==null)result(form,'invalid')
 const {error}=await db.rpc('upt_remove_task_assignment',{p_assignment:id})
 result(form,error?'save':undefined)
}
