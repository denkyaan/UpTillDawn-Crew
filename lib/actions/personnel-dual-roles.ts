'use server'
import {revalidatePath} from 'next/cache'
import {redirect} from 'next/navigation'
import {z} from 'zod'
import {createClient} from '@/lib/supabase/crew-server'
import {getCurrentUser} from '@/lib/actions/auth'
const uuid=z.string().uuid()
const role=z.enum(['staff','responsible_lead','promotion','administration','head','left_hand','right_hand'])
export async function savePersonnelRoleSlot(form:FormData){
 const actor=await getCurrentUser()
 if(!actor||!actor.realIsAdmin||!actor.approved||actor.account_blocked)throw new Error('Admin permission required')
 const user=uuid.parse(form.get('user_id'))
 const roleOne=role.parse(form.get('role_one'))
 const rawTwo=String(form.get('role_two')??'')
 const roleTwo=rawTwo&&rawTwo!=='none'?role.parse(rawTwo):null
 const slot=z.enum(['1','2']).parse(form.get('save_slot'))
 const confirmHead=form.get('confirm_head')==='yes'
 if(roleOne===roleTwo)throw new Error('Kies twee verschillende rollen')
 if(roleOne==='head'||roleTwo==='head'){
  if(confirmHead&&user!==actor.id&&slot==='1'&&roleOne!=='head')throw new Error('Invalid Head transfer')
 }
 const db=await createClient()
 const {error}=await db.rpc('upt_admin_set_two_personnel_roles' as never,{
  p_user:user,p_role_one:roleOne,p_role_two:roleTwo,p_confirm_head:confirmHead
 } as never)
 if(error)throw new Error(error.code==='23514'?'Draag eerst de Hoofdadmin over.':
  error.code==='42501'?'Alleen de Hoofdadmin kan deze wijziging uitvoeren.':
  error.code==='22023'?'Deze rollen kunnen niet gecombineerd worden of vereisen bevestiging.':
  'Rolwijziging niet uitgevoerd.')
 revalidatePath('/personnel')
 revalidatePath('/crew')
 revalidatePath('/portals')
 revalidatePath('/portals/administration')
 revalidatePath('/admin')
 redirect('/personnel?feedback=roles_saved&user='+user)
}
