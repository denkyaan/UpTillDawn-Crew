'use server'

import { markSaveSuccess, revalidatePath } from '@/lib/save-success'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/crew-server'
import { fetchFacebookEventInfo } from '@/lib/facebook-event'
import { geocodeGeoapify } from '@/lib/geoapify'

const text=z.string().trim().min(1).max(200)

function optionalIso(fd:FormData,name:string){
 const raw=String(fd.get(name)||'').trim()
 return raw?z.string().datetime({offset:true}).parse(raw):null
}

async function adminClient(){
 const s=await createClient()
 const {data:{user}}=await s.auth.getUser()
 if(!user)throw new Error('Aanmelden vereist.')
 const [{data:approved},{data:isAdmin}]=await Promise.all([s.rpc('upt_is_approved'),s.rpc('upt_is_admin',{uid:user.id})])
 if(!approved||!isAdmin)throw new Error('Geen toegang.')
 return {s,user}
}

async function eventLocation(fd:FormData,override?:{venue?:string|null;address?:string|null}){
 let venue=String(override?.venue??fd.get('venue')??'').trim().slice(0,200)
 let address=String(override?.address??fd.get('address')??'').trim().slice(0,500)
 const rawLatitude=override?.address||override?.venue?'':String(fd.get('latitude')||'').trim()
 const rawLongitude=override?.address||override?.venue?'':String(fd.get('longitude')||'').trim()
 let latitude=rawLatitude?z.coerce.number().min(-90).max(90).parse(rawLatitude):null
 let longitude=rawLongitude?z.coerce.number().min(-180).max(180).parse(rawLongitude):null
 if((latitude===null)!==(longitude===null))throw new Error('Selecteer een geldige locatie of adres uit de suggesties.')
 if(latitude===null&&longitude===null&&(address||venue)){
  const resolved=await geocodeGeoapify(address||venue)
  if(!resolved)throw new Error('Geen geldige locatie gevonden. Kies een locatie of adres uit de suggesties.')
  latitude=resolved.latitude;longitude=resolved.longitude;address=resolved.formatted
  if(!venue)venue=resolved.name
 }
 return {venue,address,latitude,longitude}
}

export async function createEvent(fd:FormData){
 const {s,user}=await adminClient()
 const facebookUrl=String(fd.get('facebook_event_url')||'').trim()
 const imported=facebookUrl?await fetchFacebookEventInfo(facebookUrl):null
 const name=text.parse(imported?.name||String(fd.get('name')||'').trim())
 const start=imported?.startAt||optionalIso(fd,'start_at')
 const end=imported?.endAt||optionalIso(fd,'end_at')
 if(!start||!end)throw new Error('Vul start- en einduur in wanneer Facebook deze niet openbaar meegeeft.')
 if(Date.parse(end)<=Date.parse(start))throw new Error('Einde moet na begin liggen.')
 const location=await eventLocation(fd,{venue:imported?.venue||undefined,address:imported?.address||undefined})
 const {data:created,error}=await s.from('events').insert({
  name,venue:location.venue,address:location.address,latitude:location.latitude,longitude:location.longitude,
  start_at:start,end_at:end,start_date:start,end_date:end,
  facebook_event_url:facebookUrl?(imported?.sourceUrl||facebookUrl):null,
  image_url:imported?.imageUrl||null,
  checkin_radius_m:z.coerce.number().int().min(10).max(10000).parse(fd.get('radius')||100),created_by:user.id,
 }).select('id').single()
 if(error||!created){console.error('[Event create]',{code:error?.code});throw new Error('Evenement aanmaken mislukt.')}
 const {error:catalogError}=await s.rpc('upt_sync_workplace_catalog_to_event',{p_event:created.id})
 if(catalogError)console.error('[Event workplace catalog sync]',{code:catalogError.code})
 await revalidatePath('/events');await revalidatePath('/chat');await revalidatePath('/workplaces');await revalidatePath('/inventory')
}

export async function captureEventTemplate(fd:FormData){
 const {s}=await adminClient()
 const eventId=z.string().uuid().parse(fd.get('event_id'))
 const name=text.parse(String(fd.get('template_name')||'').trim())
 const sections=['workplaces','briefing','tasks','checklists','inventory'].filter(section=>fd.get('section_'+section)==='on')
 if(!sections.length)throw new Error('Selecteer minstens één templateonderdeel.')
 const {error}=await s.rpc('upt_capture_event_template',{p_event:eventId,p_name:name,p_sections:sections})
 if(error)throw new Error(error.message||'Template opslaan mislukt.')
 await revalidatePath('/events')
}

export async function applyEventTemplate(fd:FormData){
 const {s}=await adminClient()
 const templateId=z.string().uuid().parse(fd.get('template_id'))
 const name=text.parse(String(fd.get('name')||'').trim())
 const start=optionalIso(fd,'start_at')
 const end=optionalIso(fd,'end_at')
 if(!start||!end||Date.parse(end)<=Date.parse(start))throw new Error('Geef geldige evenementuren.')
 const venue=String(fd.get('venue')||'').trim().slice(0,200)||undefined
 const address=String(fd.get('address')||'').trim().slice(0,500)||undefined
 const {data,error}=await s.rpc('upt_apply_event_template_v2',{
  p_template:templateId,p_name:name,p_start:start,p_end:end,p_venue:venue,p_address:address,
 })
 if(error||!data)throw new Error(error?.message||'Template toepassen mislukt.')
 await s.rpc('upt_sync_workplace_catalog_to_event',{p_event:data})
 await revalidatePath('/events');await revalidatePath('/workplaces');await revalidatePath('/inventory');await revalidatePath('/briefings')
}

export async function closeEvent(fd:FormData){
 const {s}=await adminClient()
 const eventId=z.string().uuid().parse(fd.get('event_id'))
 const force=fd.get('force')==='on'
 const reason=String(fd.get('reason')||'').trim()||undefined
 const {error}=await s.rpc('upt_close_event',{p_event:eventId,p_force:force,p_reason:reason})
 if(error)throw new Error(error.message||'Evenement afsluiten mislukt.')
 await revalidatePath('/events');await revalidatePath('/admin')
 await markSaveSuccess('event_closed')
}

export async function archiveEvent(fd:FormData){
 const {s}=await adminClient()
 const eventId=z.string().uuid().parse(fd.get('event_id'))
 const force=fd.get('force')==='on'
 const reason=String(fd.get('reason')||'').trim()
 const result=force
  ? await s.rpc('upt_force_archive_event',{p_event:eventId,p_reason:reason})
  : await s.rpc('upt_archive_event',{p_event:eventId})
 if(result.error)throw new Error(result.error.message||'Evenement archiveren mislukt.')
 await revalidatePath('/events');await revalidatePath('/admin')
 await markSaveSuccess('event_archived')
}

export async function restoreEvent(fd:FormData){
 const {s}=await adminClient()
 const eventId=z.string().uuid().parse(fd.get('event_id'))
 const reason=String(fd.get('reason')||'').trim()||undefined
 const {error}=await s.rpc('upt_restore_event',{p_event:eventId,p_reason:reason})
 if(error)throw new Error(error.message||'Evenement herstellen mislukt.')
 await revalidatePath('/events');await revalidatePath('/admin')
 await markSaveSuccess('event_restored')
}

export type EventLifecycleActionState={error:string|null}
const lifecycleError=(error:unknown,fallback:string):EventLifecycleActionState=>({error:error instanceof Error&&error.message?error.message:fallback})
export async function archiveEventWithState(_previous:EventLifecycleActionState,fd:FormData):Promise<EventLifecycleActionState>{
 try{await archiveEvent(fd);return {error:null}}catch(error){return lifecycleError(error,'Evenement archiveren mislukt.')}
}
export async function restoreEventWithState(_previous:EventLifecycleActionState,fd:FormData):Promise<EventLifecycleActionState>{
 try{await restoreEvent(fd);return {error:null}}catch(error){return lifecycleError(error,'Evenement herstellen mislukt.')}
}
