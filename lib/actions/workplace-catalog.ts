'use server'

import { revalidatePath } from '@/lib/save-success'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/crew-server'

const uuid=z.string().uuid()
const text=z.string().trim().min(1).max(200)

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

function capacity(fd:FormData){
  const minimum=z.coerce.number().int().min(0).max(10000).parse(fd.get('minimum_staff')||0)
  const target=z.coerce.number().int().min(0).max(10000).parse(fd.get('target_staff')||0)
  const maximumRaw=String(fd.get('maximum_staff')||'').trim()
  const maximum=maximumRaw?z.coerce.number().int().min(0).max(10000).parse(maximumRaw):undefined
  if(minimum>target||(maximum!==undefined&&target>maximum))throw new Error('Bezetting moet voldoen aan minimum ≤ doel ≤ maximum.')
  return {minimum,target,maximum}
}

async function syncFutureEvents(s:Awaited<ReturnType<typeof createClient>>){
  const {data:events}=await s.from('events').select('id').neq('status','archived').gte('end_at',new Date().toISOString())
  for(const event of events||[]){
    await s.rpc('upt_sync_workplace_catalog_to_event',{p_event:event.id})
  }
}

function refresh(){
  await revalidatePath('/inventory')
  await revalidatePath('/workplaces')
  await revalidatePath('/events')
}

export async function createCatalogWorkplace(fd:FormData){
  const s=await adminClient()
  const c=capacity(fd)
  const {error}=await s.rpc('upt_create_workplace_catalog',{
    p_name:text.parse(fd.get('name')),
    p_description:String(fd.get('description')||'').trim().slice(0,1000)||undefined,
    p_sort_order:z.coerce.number().int().min(0).max(10000).parse(fd.get('sort_order')||0),
    p_minimum_staff:c.minimum,
    p_target_staff:c.target,
    p_maximum_staff:c.maximum,
  })
  if(error)throw new Error(error.message)
  await syncFutureEvents(s)
  refresh()
}

export async function updateCatalogWorkplace(fd:FormData){
  const s=await adminClient()
  const c=capacity(fd)
  const {error}=await s.rpc('upt_update_workplace_catalog',{
    p_workplace:uuid.parse(fd.get('workplace_id')),
    p_name:text.parse(fd.get('name')),
    p_description:String(fd.get('description')||'').trim().slice(0,1000)||undefined,
    p_sort_order:z.coerce.number().int().min(0).max(10000).parse(fd.get('sort_order')||0),
    p_minimum_staff:c.minimum,
    p_target_staff:c.target,
    p_maximum_staff:c.maximum,
    p_is_active:fd.get('is_active')==='on',
  })
  if(error)throw new Error(error.message)
  await syncFutureEvents(s)
  refresh()
}

export async function createCatalogItem(fd:FormData){
  const s=await adminClient()
  const {error}=await s.rpc('upt_create_workplace_catalog_item',{
    p_workplace:uuid.parse(fd.get('workplace_id')),
    p_name:text.parse(fd.get('name')),
    p_category:String(fd.get('category')||'').trim().slice(0,120)||undefined,
    p_quantity:z.coerce.number().int().min(0).max(100000).parse(fd.get('quantity')||0),
  })
  if(error)throw new Error(error.message)
  await syncFutureEvents(s)
  refresh()
}

export async function updateCatalogItem(fd:FormData){
  const s=await adminClient()
  const {error}=await s.rpc('upt_update_workplace_catalog_item',{
    p_item:uuid.parse(fd.get('item_id')),
    p_name:text.parse(fd.get('name')),
    p_category:String(fd.get('category')||'').trim().slice(0,120)||undefined,
    p_quantity:z.coerce.number().int().min(0).max(100000).parse(fd.get('quantity')||0),
    p_is_active:fd.get('is_active')==='on',
  })
  if(error)throw new Error(error.message)
  await syncFutureEvents(s)
  refresh()
}

export async function syncCatalogToEvent(fd:FormData){
  const s=await adminClient()
  const {error}=await s.rpc('upt_sync_workplace_catalog_to_event',{p_event:uuid.parse(fd.get('event_id'))})
  if(error)throw new Error(error.message)
  refresh()
}
