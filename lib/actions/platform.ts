'use server'

import { revalidatePath } from '@/lib/save-success'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/crew-server'

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
  return {s,user}
}

function refresh(){
  for(const path of ['/admin/platform','/events','/shifts','/inventory','/operations'])await revalidatePath(path)
}

export async function generatePlanningRecommendations(fd:FormData){
  const {s}=await adminClient()
  const {error}=await s.rpc('upt_generate_planning_recommendations',{p_event:uuid.parse(fd.get('event_id'))})
  if(error)throw new Error(error.message)
  refresh()
}

export async function applyPlanningRecommendation(fd:FormData){
  const {s}=await adminClient()
  const {error}=await s.rpc('upt_apply_planning_recommendation',{p_recommendation:uuid.parse(fd.get('recommendation_id'))})
  if(error)throw new Error(error.message)
  refresh()
}

export async function dismissPlanningRecommendation(fd:FormData){
  const {s}=await adminClient()
  const {error}=await s.rpc('upt_dismiss_planning_recommendation',{p_recommendation:uuid.parse(fd.get('recommendation_id'))})
  if(error)throw new Error(error.message)
  refresh()
}

export async function generateEventReport(fd:FormData){
  const {s}=await adminClient()
  const {error}=await s.rpc('upt_generate_event_report',{p_event:uuid.parse(fd.get('event_id'))})
  if(error)throw new Error(error.message)
  refresh()
}

export async function savePayRate(fd:FormData){
  const {s,user}=await adminClient()
  const userId=uuid.parse(fd.get('user_id'))
  const hourly=z.coerce.number().min(0).max(100000).parse(fd.get('hourly_rate'))
  const multiplier=z.coerce.number().min(1).max(5).parse(fd.get('employer_multiplier')||1)
  const effectiveFrom=z.string().date().parse(fd.get('effective_from'))
  const notes=String(fd.get('notes')||'').trim().slice(0,1000)||null
  const {error}=await s.from('staff_pay_rates').insert({
    user_id:userId,
    hourly_rate_cents:Math.round(hourly*100),
    employer_cost_multiplier_bps:Math.round(multiplier*10000),
    currency:'EUR',
    effective_from:effectiveFrom,
    notes,
    created_by:user.id,
  })
  if(error)throw new Error('Kostentarief kon niet worden opgeslagen.')
  refresh()
}

export async function createKnowledgeArticle(fd:FormData){
  const {s,user}=await adminClient()
  const eventRaw=String(fd.get('event_id')||'')
  const workplaceRaw=String(fd.get('workplace_id')||'')
  const title=z.string().trim().min(1).max(200).parse(fd.get('title'))
  const body=z.string().trim().min(1).max(20000).parse(fd.get('body'))
  const {error}=await s.from('knowledge_articles').insert({
    event_id:eventRaw?uuid.parse(eventRaw):null,
    workplace_id:workplaceRaw?uuid.parse(workplaceRaw):null,
    category:String(fd.get('category')||'').trim().slice(0,120)||null,
    title,body,
    offline_critical:fd.get('offline_critical')==='on',
    is_published:true,
    created_by:user.id,
  })
  if(error)throw new Error('Kennisartikel kon niet worden opgeslagen.')
  refresh()
}

export async function createQrResource(fd:FormData){
  const {s,user}=await adminClient()
  const eventRaw=String(fd.get('event_id')||'')
  const workplaceRaw=String(fd.get('workplace_id')||'')
  const resourceRaw=String(fd.get('resource_id')||'')
  const {error}=await s.from('qr_resources').insert({
    event_id:eventRaw?uuid.parse(eventRaw):null,
    workplace_id:workplaceRaw?uuid.parse(workplaceRaw):null,
    resource_type:z.enum(['workplace','inventory','document','checklist','task','knowledge']).parse(fd.get('resource_type')),
    resource_id:resourceRaw?uuid.parse(resourceRaw):null,
    title:z.string().trim().min(1).max(200).parse(fd.get('title')),
    route:z.string().trim().min(1).max(500).parse(fd.get('route')),
    active:true,
    created_by:user.id,
  })
  if(error)throw new Error('QR-resource kon niet worden aangemaakt.')
  refresh()
}

export async function setFeatureRollout(fd:FormData){
  const {s}=await adminClient()
  const {error}=await s.rpc('upt_set_feature_rollout',{
    p_feature_key:z.string().trim().min(1).max(120).parse(fd.get('feature_key')),
    p_enabled:fd.get('enabled')==='on',
    p_audience:z.enum(['all','admin','responsible','staff']).parse(fd.get('audience')),
    p_rollout_percentage:z.coerce.number().int().min(0).max(100).parse(fd.get('rollout_percentage')),
    p_notes:String(fd.get('notes')||'').trim().slice(0,1000)||undefined,
  })
  if(error)throw new Error(error.message)
  refresh()
}

export async function snapshotPlatformConfiguration(fd:FormData){
  const {s}=await adminClient()
  const {error}=await s.rpc('upt_snapshot_platform_configuration',{p_note:String(fd.get('note')||'').trim().slice(0,1000)||undefined})
  if(error)throw new Error(error.message)
  refresh()
}

export async function captureEventTemplate(fd:FormData){
  const {s}=await adminClient()
  const sections=fd.getAll('section').map(String)
  const {error}=await s.rpc('upt_capture_event_template',{
    p_event:uuid.parse(fd.get('event_id')),
    p_name:z.string().trim().min(3).max(200).parse(fd.get('name')),
    p_sections:sections,
  })
  if(error)throw new Error(error.message)
  refresh()
}

export async function applyEventTemplate(fd:FormData){
  const {s}=await adminClient()
  const start=z.string().datetime({offset:true}).parse(fd.get('start_at'))
  const end=z.string().datetime({offset:true}).parse(fd.get('end_at'))
  const {data,error}=await s.rpc('upt_apply_event_template',{
    p_template:uuid.parse(fd.get('template_id')),
    p_name:z.string().trim().min(1).max(200).parse(fd.get('name')),
    p_start:start,
    p_end:end,
    p_venue:String(fd.get('venue')||'').trim().slice(0,200)||undefined,
    p_address:String(fd.get('address')||'').trim().slice(0,500)||undefined,
  })
  if(error)throw new Error(error.message)
  refresh()
  if(data)redirect('/events')
}

export async function updateAssetMetadata(fd:FormData){
  const {s}=await adminClient()
  const id=uuid.parse(fd.get('item_id'))
  const reorder=z.coerce.number().int().min(0).max(100000).parse(fd.get('reorder_threshold')||0)
  const unit=String(fd.get('unit_cost')||'').trim()
  const {error}=await s.from('inventory_items').update({
    asset_code:String(fd.get('asset_code')||'').trim().slice(0,120)||null,
    barcode:String(fd.get('barcode')||'').trim().slice(0,200)||null,
    serial_number:String(fd.get('serial_number')||'').trim().slice(0,200)||null,
    location_label:String(fd.get('location_label')||'').trim().slice(0,300)||null,
    maintenance_due_at:String(fd.get('maintenance_due_at')||'').trim()||null,
    reorder_threshold:reorder,
    unit_cost_cents:unit?Math.round(z.coerce.number().min(0).max(10000000).parse(unit)*100):null,
    asset_notes:String(fd.get('asset_notes')||'').trim().slice(0,4000)||null,
  }).eq('id',id)
  if(error)throw new Error('Assetgegevens konden niet worden opgeslagen.')
  refresh()
}


export async function restorePlatformConfiguration(fd:FormData){
  const {s}=await adminClient()
  const {error}=await s.rpc('upt_restore_platform_configuration',{p_version:uuid.parse(fd.get('version_id'))})
  if(error)throw new Error(error.message)
  refresh()
}
