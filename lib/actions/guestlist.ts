'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/crew-server'

const uuid=z.string().uuid()
const type=z.enum(['artist','guest'])

async function adminClient(){
  const s=await createClient()
  const {data:{user}}=await s.auth.getUser()
  if(!user)throw new Error('Aanmelden vereist.')
  const [{data:approved},{data:isAdmin}]=await Promise.all([
    s.rpc('upt_is_approved'),
    s.rpc('upt_is_admin',{uid:user.id}),
  ])
  if(!approved||!isAdmin)throw new Error('Geen toegang.')
  return s
}

function refresh(){
  revalidatePath('/guestlist')
  revalidatePath('/admin/platform')
}

export async function addGuestlistEntry(fd:FormData){
  const s=await adminClient()
  const {error}=await s.rpc('upt_guestlist_add_entry',{
    p_event:uuid.parse(fd.get('event_id')),
    p_name:z.string().trim().min(1).max(240).parse(fd.get('name')),
    p_entry_type:type.parse(fd.get('entry_type')),
    p_spots:z.coerce.number().int().min(1).max(100).parse(fd.get('spots')||1),
    p_notes:String(fd.get('notes')||'').trim().slice(0,2000)||undefined,
  })
  if(error)throw new Error(error.message)
  refresh()
}

export async function updateGuestlistEntry(fd:FormData){
  const s=await adminClient()
  const {error}=await s.rpc('upt_guestlist_update_entry',{
    p_entry:uuid.parse(fd.get('entry_id')),
    p_name:z.string().trim().min(1).max(240).parse(fd.get('name')),
    p_entry_type:type.parse(fd.get('entry_type')),
    p_spots:z.coerce.number().int().min(1).max(100).parse(fd.get('spots')||1),
    p_notes:String(fd.get('notes')||'').trim().slice(0,2000)||undefined,
  })
  if(error)throw new Error(error.message)
  refresh()
}

export async function removeGuestlistEntry(fd:FormData){
  const s=await adminClient()
  const {error}=await s.rpc('upt_guestlist_remove_entry',{p_entry:uuid.parse(fd.get('entry_id'))})
  if(error)throw new Error(error.message)
  refresh()
}

export async function setBackstageWorkplace(fd:FormData){
  const s=await adminClient()
  const {error}=await s.rpc('upt_guestlist_set_backstage_workplace',{
    p_event:uuid.parse(fd.get('event_id')),
    p_workplace:uuid.parse(fd.get('workplace_id')),
  })
  if(error)throw new Error(error.message)
  refresh()
}

export async function setArtistHospitality(fd:FormData){
  const s=await adminClient()
  const {error}=await s.rpc('upt_guestlist_set_artist_hospitality',{
    p_entry:uuid.parse(fd.get('entry_id')),
    p_drinks:String(fd.get('drinks')||'').trim().slice(0,3000)||undefined,
    p_notes:String(fd.get('hospitality_notes')||'').trim().slice(0,3000)||undefined,
  })
  if(error)throw new Error(error.message)
  refresh()
}
