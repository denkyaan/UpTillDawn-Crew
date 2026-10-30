import 'server-only'
import {getCurrentUser} from '@/lib/actions/auth'
import {createClient} from '@/lib/supabase/crew-server'
import {canOpenPortal,type PortalAssignment} from '@/lib/portal-access'

/** Resolve current portal grants; do not depend on unreleased database functions. */
export async function administrationPageAccess(){
 const user=await getCurrentUser()
 if(!user)return {ok:false as const,status:401}
 if((!user.approved||user.account_blocked)&&!user.isOwner)return {ok:false as const,status:403}
 const db=await createClient()
 if(user.realIsAdmin||user.isOwner)return {ok:true as const,db,user}
 const {data,error}=await db.rpc('upt_my_portal_assignments')
 if(error)return {ok:false as const,status:503}
 if(!canOpenPortal('administration',(data??[]) as PortalAssignment[],{approved:user.approved,blocked:Boolean(user.account_blocked)}))return {ok:false as const,status:403}
 return {ok:true as const,db,user}
}
