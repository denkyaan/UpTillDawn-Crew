'use server'

import { revalidatePath } from '@/lib/save-success'
import {z} from 'zod'
import {createClient} from '@/lib/supabase/crew-server'

const uuid=z.string().uuid()

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

function euroToCents(value:FormDataEntryValue|null){
  const normalized=String(value||'').trim().replace(',','.')
  const amount=Number(normalized)
  if(!Number.isFinite(amount)||amount<0||amount>100000)throw new Error('Geef een geldig bedrag.')
  return Math.round(amount*100)
}

function refresh(){
  await revalidatePath('/sales')
  await revalidatePath('/inventory')
  await revalidatePath('/admin/platform')
}

export async function configureSaleItem(fd:FormData){
  const s=await adminClient()
  const enabled=fd.get('enabled')==='on'
  const {error}=await s.rpc('upt_sales_configure_item',{
    p_item:uuid.parse(fd.get('item_id')),
    p_enabled:enabled,
    p_category:enabled?z.enum(['merch','token']).parse(fd.get('sale_category')):undefined,
    p_price_cents:enabled?euroToCents(fd.get('price')):undefined,
  })
  if(error)throw new Error(error.message)
  refresh()
}

export async function setOpeningCash(fd:FormData){
  const s=await adminClient()
  const {error}=await s.rpc('upt_sales_set_opening_cash',{
    p_event:uuid.parse(fd.get('event_id')),
    p_workplace:uuid.parse(fd.get('workplace_id')),
    p_opening_cash_cents:euroToCents(fd.get('opening_cash')),
  })
  if(error)throw new Error(error.message)
  refresh()
}

export async function refundSale(fd:FormData){
  const s=await adminClient()
  const {error}=await s.rpc('upt_sales_refund',{
    p_sale:uuid.parse(fd.get('sale_id')),
    p_quantity:z.coerce.number().int().min(1).max(10000).parse(fd.get('quantity')||1),
    p_notes:String(fd.get('notes')||'').trim().slice(0,1000)||undefined,
  })
  if(error)throw new Error(error.message)
  refresh()
}
