'use server'
import {revalidatePath} from 'next/cache'
import {redirect} from 'next/navigation'
import {z} from 'zod'
import {createClient} from '@/lib/supabase/crew-server'
import {getCurrentUser} from '@/lib/actions/auth'

export type RoleSaveState={error:string|null}
const uuid=z.string().uuid()
const role=z.enum(['staff','responsible_lead','promotion','administration','head','left_hand','right_hand'])
const leadership=new Set(['head','left_hand','right_hand'])
export async function savePersonnelRoleSlot(_state:RoleSaveState,form:FormData):Promise<RoleSaveState>{
 const actor=await getCurrentUser()
 if(!actor||!actor.realIsAdmin||!actor.approved||actor.account_blocked)return {error:'Je hebt geen toestemming om rollen te wijzigen.'}
 const id=uuid.safeParse(form.get('user_id'))
 const first=role.safeParse(form.get('role_one'))
 const rawTwo=String(form.get('role_two')??'')
 const second=rawTwo&&rawTwo!=='none'?role.safeParse(rawTwo):null
 const slot=z.enum(['1','2']).safeParse(form.get('save_slot'))
 if(!id.success||!first.success||!slot.success||(second&&!second.success))return {error:'Ongeldige rolkeuze. Controleer de velden.'}
 const user=id.data,roleOne=first.data,roleTwo=second?.data??null
 const confirmHead=form.get('confirm_head')==='yes'
 if(roleOne===roleTwo)return {error:'Rol 1 en Rol 2 moeten verschillend zijn.'}
 if((roleOne==='staff'&&roleTwo==='responsible_lead')||(roleOne==='responsible_lead'&&roleTwo==='staff')||
   (leadership.has(roleOne)&&roleTwo!==null&&leadership.has(roleTwo))||
   (roleOne==='administration'&&roleTwo!==null&&leadership.has(roleTwo))||
   (roleTwo==='administration'&&leadership.has(roleOne)))
  return {error:'Deze combinatie van twee rollen is niet toegestaan. Kies een andere tweede rol.'}
 const db=await createClient()
 const {error}=await db.rpc('upt_admin_set_two_personnel_roles' as never,{
  p_user:user,p_role_one:roleOne,p_role_two:roleTwo,p_confirm_head:confirmHead
 } as never)
 if(error){
  console.error('[personnel-role-save] database rejected role change',{code:error.code})
  return {error:error.code==='23514'?'Draag eerst de Hoofdadminrechten over.':
   error.code==='42501'?'Alleen de Hoofdadmin kan deze wijziging uitvoeren.':
   error.code==='23505'?'Deze leidinggevende functie is al toegewezen.':
   error.code==='22023'?'Deze rolcombinatie is niet toegestaan of vereist extra bevestiging.':
   'Rolwijziging niet uitgevoerd. Meld foutcode '+(error.code||'onbekend')+'.'}
 }
 revalidatePath('/personnel')
 revalidatePath('/crew')
 revalidatePath('/portals')
 revalidatePath('/portals/administration')
 revalidatePath('/admin')
 redirect('/personnel?feedback=roles_saved&user='+user)
}
