'use server'
import { revalidatePath } from '@/lib/save-success'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/crew-server'
const uuid=z.string().uuid()
export async function deletePersonnel(fd:FormData){
 const s=await createClient();const {data:{user}}=await s.auth.getUser();if(!user)throw new Error('Aanmelden vereist.')
 const target=uuid.parse(fd.get('user_id'));if(target===user.id)throw new Error('Je kunt je eigen account niet verwijderen.')
 const [{data:isAdmin},{data:profile},{data:attachments}]=await Promise.all([s.rpc('upt_is_admin',{uid:user.id}),s.from('profiles').select('profile_photo_url').eq('id',target).maybeSingle(),s.from('work_attachments').select('storage_path').eq('uploaded_by',target)])
 if(!isAdmin)throw new Error('Geen toegang.')
 const workPaths=(attachments||[]).map(row=>row.storage_path).filter(Boolean)
 if(workPaths.length){const {error}=await s.storage.from('work-media').remove(workPaths);if(error)throw new Error('Media van deze gebruiker kon niet veilig worden verwijderd.')}
 if(profile?.profile_photo_url){const {error}=await s.storage.from('profile-photos').remove([profile.profile_photo_url]);if(error)throw new Error('Profielfoto kon niet veilig worden verwijderd.')}
 const {error}=await s.rpc('upt_admin_set_account',{p_user:target,p_approved:false,p_role:'__delete__'});if(error)throw new Error(error.message||'Gebruiker verwijderen mislukt.')
 await revalidatePath('/personnel');await revalidatePath('/chat');await revalidatePath('/events');await revalidatePath('/workplaces');await revalidatePath('/shifts');await revalidatePath('/tasks');await revalidatePath('/briefings');await revalidatePath('/')
}


export async function setPersonnelBlock(fd:FormData){
 const s=await createClient();const {data:{user}}=await s.auth.getUser();if(!user)throw new Error('Aanmelden vereist.')
 const target=uuid.parse(fd.get('user_id'));if(target===user.id)throw new Error('Je kunt je eigen account niet blokkeren.')
 const {data:isAdmin}=await s.rpc('upt_is_admin',{uid:user.id});if(!isAdmin)throw new Error('Geen toegang.')
 const blocked=String(fd.get('blocked')||'')==='true'
 const reason=String(fd.get('reason')||'').trim().slice(0,1000)||undefined
 const {error}=await s.rpc('upt_admin_set_personnel_block',{p_user:target,p_blocked:blocked,p_reason:reason})
 if(error)throw new Error(error.message)
 await revalidatePath('/personnel');await revalidatePath('/');await revalidatePath('/events');await revalidatePath('/shifts');await revalidatePath('/workplaces')
}
