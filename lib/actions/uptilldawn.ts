'use server'
import { createClient } from '@/lib/supabase/crew-server'
import { revalidatePath } from '@/lib/save-success'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { geocodeGeoapify } from '@/lib/geoapify'
import { fetchFacebookEventInfo } from '@/lib/facebook-event'
import { responsibleHasConflict } from '@/lib/responsible-coverage'
import { workplaceCapacityIsValid } from '@/lib/workplace-capacity'
import { declineRequiresReason } from '@/lib/crew-self-service'
const uuid=z.string().uuid()
const text=z.string().trim().min(1).max(200)
async function adminClient(){
 const s=await createClient()
 const {data:{user}}=await s.auth.getUser()
 if(!user) throw new Error('Aanmelden vereist.')
 const [{data:isApproved},{data:hasAdminPrivilege}]=await Promise.all([
  s.rpc('upt_is_approved'),
  s.rpc('upt_is_admin',{uid:user.id}),
 ])
 if(!isApproved||!hasAdminPrivilege) throw new Error('Geen toegang.')
 return {s,user}
}
async function approvedClient(){
 const s=await createClient()
 const {data:{user}}=await s.auth.getUser()
 if(!user) throw new Error('Aanmelden vereist.')
 const {data:profile}=await s.from('profiles').select('approved,role').eq('id',user.id).single()
 if(!profile?.approved) throw new Error('ACCOUNT NOG NIET GOEDGEKEURD')
 const {data:effectiveRole}=await s.rpc('upt_current_effective_role')
 return {s,user,profile:{...profile,role:effectiveRole||profile.role}}
}
function check(error:{code?:string}|null){if(error){console.error('[Crew mutation]',{code:error.code});throw new Error('Opslaan mislukt. Controleer je invoer en probeer opnieuw.')}}
function requireManager(role:string){if(!['admin','responsible_lead'].includes(role))throw new Error('Geen toegang.')}
async function requireEventManager(
 s: Awaited<ReturnType<typeof createClient>>,
 userId: string,
 role: string,
 eventId: string,
){
 if(role==='admin')return
 if(role!=='responsible_lead')throw new Error('Geen toegang.')
 const {data,error}=await s.from('event_members')
  .select('event_id')
  .eq('event_id',eventId)
  .eq('user_id',userId)
  .in('event_role',['responsible_lead','admin'])
  .maybeSingle()
 check(error)
 if(!data)throw new Error('Je bent niet als verantwoordelijke aan dit evenement toegewezen.')
}
async function requireFeature(
 s: Awaited<ReturnType<typeof createClient>>,
 role: string,
 feature: string,
 eventId: string | null,
 workplaceId: string | null = null,
){
 if(role==='admin')return
 const {data,error}=await s.rpc('upt_feature_allowed',{
  p_feature:feature,
  p_event:eventId ?? undefined,
  p_workplace:workplaceId ?? undefined,
 })
 if(error||!data)throw new Error('Deze functie is voor jouw rol op dit moment niet beschikbaar.')
}
type WorkPhotoTarget = { type: 'briefing' | 'instruction' | 'task'; id: string }
const eventDocumentTypes=new Map([
 ['image/jpeg','jpg'],
 ['image/png','png'],
 ['image/webp','webp'],
 ['application/pdf','pdf'],
 ['text/plain','txt'],
 ['text/csv','csv'],
 ['application/vnd.openxmlformats-officedocument.wordprocessingml.document','docx'],
 ['application/vnd.openxmlformats-officedocument.presentationml.presentation','pptx'],
 ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','xlsx'],
])
const photoTypes = new Map([
 ['image/jpeg','jpg'],
 ['image/png','png'],
 ['image/webp','webp'],
 ['video/mp4','mp4'],
 ['video/webm','webm'],
 ['video/quicktime','mov'],
 ['application/pdf','pdf'],
 ['text/plain','txt'],
 ['text/csv','csv'],
 ['application/vnd.openxmlformats-officedocument.wordprocessingml.document','docx'],
 ['application/vnd.openxmlformats-officedocument.presentationml.presentation','pptx'],
 ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','xlsx'],
])
function workPhotoFiles(fd: FormData) {
 const files=[
  ...fd.getAll('photos'),
  fd.get('briefing_document'),
 ].filter((value): value is File => value instanceof File && value.size > 0)
 if(files.length>6) throw new Error('Je kunt maximaal 6 bijlagen toevoegen.')
 for(const file of files){
  const isVideo=file.type.startsWith('video/')
  const isImage=file.type.startsWith('image/')
  const max=isVideo?50*1024*1024:isImage?10*1024*1024:20*1024*1024
  if(file.size>max){
   throw new Error(
    isVideo
     ? 'Elke video mag maximaal 50 MB zijn.'
     : isImage
       ? 'Elke afbeelding mag maximaal 10 MB zijn.'
       : 'Elk document mag maximaal 20 MB zijn.'
   )
  }
  if(!photoTypes.has(file.type)){
   throw new Error('Gebruik alleen PDF, DOCX, PPTX, XLSX, TXT, CSV, JPG, PNG, WEBP, MP4, WEBM of MOV.')
  }
 }
 return files
}
async function rollbackWorkPhotos(s:Awaited<ReturnType<typeof createClient>>,paths:string[]){
 if(!paths.length)return
 await s.from('work_attachments').delete().in('storage_path',paths)
 await s.storage.from('work-media').remove(paths)
}
async function uploadWorkPhotos(
 s:Awaited<ReturnType<typeof createClient>>,
 userId:string,
 target:WorkPhotoTarget,
 files:File[],
){
 if(!files.length)return [] as string[]
 const key=target.type==='briefing'?'briefing_id':target.type==='instruction'?'personal_instruction_id':'task_id'
 const {count,error:countError}=await s.from('work_attachments').select('id',{count:'exact',head:true}).eq(key,target.id)
 check(countError)
 if((count??0)+files.length>10) throw new Error('Per briefing kun je maximaal 10 bijlagen bewaren.')
 const uploaded:string[]=[]
 try{
  for(const file of files){
   const ext=photoTypes.get(file.type)!
   const storagePath=`${userId}/${target.type}/${target.id}/${crypto.randomUUID()}.${ext}`
   const {error:uploadError}=await s.storage.from('work-media').upload(storagePath,file,{contentType:file.type,upsert:false})
   if(uploadError) throw new Error('Media uploaden mislukt.')
   uploaded.push(storagePath)
   const parent=target.type==='briefing'
    ? {briefing_id:target.id}
    : target.type==='instruction'
      ? {personal_instruction_id:target.id}
      : {task_id:target.id}
   const {error:attachmentError}=await s.from('work_attachments').insert({
    ...parent,
    storage_path:storagePath,
    mime_type:file.type,
    uploaded_by:userId,
   })
   if(attachmentError) throw new Error('Media koppelen mislukt.')
  }
  return uploaded
 }catch(error){
  await rollbackWorkPhotos(s,uploaded)
  throw error
 }
}
function workplaceCapacityValues(fd:FormData){
 const minimumStaff=z.coerce.number().int().min(0).max(10000).parse(fd.get('minimum_staff')||0)
 const targetStaff=z.coerce.number().int().min(0).max(10000).parse(fd.get('target_staff')||0)
 const maximumRaw=String(fd.get('maximum_staff')||'').trim()
 const maximumStaff=maximumRaw?z.coerce.number().int().min(0).max(10000).parse(maximumRaw):null
 if(!workplaceCapacityIsValid({
  workplaceId:'form',
  minimumStaff,
  targetStaff,
  maximumStaff,
 }))throw new Error('Bezetting moet voldoen aan minimum ≤ doel ≤ maximum.')
 return {minimum_staff:minimumStaff,target_staff:targetStaff,maximum_staff:maximumStaff}
}
function shiftMutationCheck(error:{code?:string;message?:string}|null){
 if(error?.message?.includes('Maximumbezetting'))throw new Error('Maximumbezetting van deze werkplek wordt overschreden.')
 check(error)
}
function dates(fd:FormData,start:string,end:string){
 const a=z.string().datetime({offset:true}).parse(fd.get(start)),b=z.string().datetime({offset:true}).parse(fd.get(end))
 if(Date.parse(b)<=Date.parse(a)) throw new Error('Einde moet na begin liggen.')
 return [a,b]
}
async function eventLocation(fd:FormData,override?:{venue?:string|null;address?:string|null}){
 let venue=String(override?.venue??fd.get('venue')??'').trim().slice(0,200)
 let address=String(override?.address??fd.get('address')??'').trim().slice(0,500)
 const rawLatitude=override?.address||override?.venue?'':String(fd.get('latitude')||'').trim()
 const rawLongitude=override?.address||override?.venue?'':String(fd.get('longitude')||'').trim()
 let latitude=rawLatitude?z.coerce.number().min(-90).max(90).parse(rawLatitude):null
 let longitude=rawLongitude?z.coerce.number().min(-180).max(180).parse(rawLongitude):null
 if((latitude===null)!==(longitude===null)){
  throw new Error('Selecteer een geldige locatie of adres uit de suggesties.')
 }
 if(latitude===null&&longitude===null&&(address||venue)){
  const resolved=await geocodeGeoapify(address||venue)
  if(!resolved)throw new Error('Geen geldige locatie gevonden. Kies een locatie of adres uit de suggesties.')
  latitude=resolved.latitude
  longitude=resolved.longitude
  address=resolved.formatted
  if(!venue)venue=resolved.name
 }
 return {venue,address,latitude,longitude}
}
function optionalIso(fd:FormData,name:string){
 const raw=String(fd.get(name)||'').trim()
 return raw?z.string().datetime({offset:true}).parse(raw):null
}

function optionalPositiveInt(fd:FormData,name:string){
 const raw=String(fd.get(name)||'').trim()
 return raw?z.coerce.number().int().min(1).max(10000).parse(raw):null
}
export async function createEvent(fd:FormData){
 const {s,user}=await adminClient()
 const facebookUrl=String(fd.get('facebook_event_url')||'').trim()
 const imported=facebookUrl?await fetchFacebookEventInfo(facebookUrl):null
 const manualName=String(fd.get('name')||'').trim()
 const name=text.parse(imported?.name||manualName)
 const start=imported?.startAt||optionalIso(fd,'start_at')
 const end=imported?.endAt||optionalIso(fd,'end_at')
 const maxJoiners=optionalPositiveInt(fd,'max_joiners')
 if(!start||!end)throw new Error('Vul start- en einduur in wanneer Facebook deze niet openbaar meegeeft.')
 const registrationDeadline=optionalIso(fd,'registration_deadline')||start
 if(Date.parse(end)<=Date.parse(start))throw new Error('Einde moet na begin liggen.')
 if(Date.parse(registrationDeadline)>Date.parse(start))throw new Error('De aanmelddeadline moet vóór of op de start van het evenement liggen.')
 const location=await eventLocation(fd,{
  venue:imported?.venue||undefined,
  address:imported?.address||undefined,
 })
 const {error}=await s.from('events').insert({
  name,
  venue:location.venue,
  address:location.address,
  latitude:location.latitude,longitude:location.longitude,
  start_at:start,end_at:end,start_date:start,end_date:end,
  registration_deadline:registrationDeadline,
  max_joiners:maxJoiners,
  facebook_event_url:facebookUrl?(imported?.sourceUrl||facebookUrl):null,
  checkin_radius_m:z.coerce.number().int().min(10).max(10000).parse(fd.get('radius')||100),
  created_by:user.id,
 })
 check(error);await revalidatePath('/events')
}
export async function addWorkplace(fd:FormData){
 const {s}=await adminClient()
 const eventId=uuid.parse(fd.get('event_id'))
 const capacity=workplaceCapacityValues(fd)
 const {error}=await s.from('workplaces').insert({
  event_id:eventId,
  name:text.parse(fd.get('name')),
  description:String(fd.get('description')||'').trim().slice(0,1000)||null,
  sort_order:z.coerce.number().int().min(0).max(10000).parse(fd.get('sort_order')||0),
  is_active:true,
  ...capacity,
 })
 check(error);await revalidatePath('/workplaces');await revalidatePath('/shifts')
}
export async function updateWorkplace(fd:FormData){
 const {s}=await adminClient()
 const workplaceId=uuid.parse(fd.get('workplace_id'))
 const capacity=workplaceCapacityValues(fd)
 const {data:workplace,error:workplaceError}=await s.from('workplaces').select('event_id').eq('id',workplaceId).single()
 check(workplaceError);if(!workplace)throw new Error('Werkplek niet gevonden.')
 const {error}=await s.from('workplaces').update({
  name:text.parse(fd.get('name')),
  description:String(fd.get('description')||'').trim().slice(0,1000)||null,
  sort_order:z.coerce.number().int().min(0).max(10000).parse(fd.get('sort_order')||0),
  is_active:fd.get('is_active')==='on',
  ...capacity,
 }).eq('id',workplaceId)
 check(error);await revalidatePath('/workplaces');await revalidatePath('/shifts')
}
export async function setEventAvailability(fd:FormData){
 const {s}=await approvedClient()
 const eventId=uuid.parse(fd.get('event_id'))
 const response=z.enum(['can','cannot']).parse(fd.get('response'))
 const setup=z.enum(['yes','no']).parse(fd.get('setup_available'))==='yes'
 const breakdown=z.enum(['yes','no']).parse(fd.get('breakdown_available'))==='yes'
 const reason=String(fd.get('reason')||'').trim().slice(0,1000)||undefined
 const {error}=await s.rpc('upt_set_event_availability_with_reason',{
  p_event:eventId,
  p_response:response,
  p_setup:setup,
  p_breakdown:breakdown,
  p_reason:reason,
 })
 if(error?.message?.includes('Geef een reden')||error?.message?.includes('Afmeldreden')){
  throw new Error('Geef een reden waarom je niet meer kunt deelnemen.')
 }
 check(error)
 await revalidatePath('/events')
}
export async function addEventMember(fd:FormData){
 const {s}=await adminClient()
 const eventId=uuid.parse(fd.get('event_id'))
 const userId=uuid.parse(fd.get('user_id'))
 const [{data:p},{data:availability}]=await Promise.all([
  s.from('profiles').select('approved,role').eq('id',userId).single(),
  s.from('event_availability').select('response').eq('event_id',eventId).eq('user_id',userId).maybeSingle(),
 ])
 if(!p?.approved)throw new Error('Account niet goedgekeurd.')
 if(availability?.response!=='can')throw new Error('Selecteer iemand die heeft aangeduid dat die kan.')
 const eventRole=p.role==='responsible_lead'?'responsible_lead':p.role==='admin'?'admin':'employee'
 const {error}=await s.from('event_members').upsert({event_id:eventId,user_id:userId,event_role:eventRole},{onConflict:'event_id,user_id'})
 check(error)
 await revalidatePath('/events');await revalidatePath('/tasks');await revalidatePath('/briefings');await revalidatePath('/shifts');await revalidatePath('/workplaces')
}
export async function addAvailableEventMembers(fd:FormData){
 const {s}=await adminClient()
 const eventId=uuid.parse(fd.get('event_id'))
 const userIds=[...new Set(fd.getAll('user_id').map(value=>uuid.parse(value)))]
 if(!userIds.length)throw new Error('Selecteer minstens één persoon.')
 const [{data:available,error:availabilityError},{data:approved,error:profileError}]=await Promise.all([
  s.from('event_availability').select('user_id').eq('event_id',eventId).eq('response','can').in('user_id',userIds),
  s.from('profiles').select('id,role').eq('approved',true).in('id',userIds),
 ])
 check(availabilityError);check(profileError)
 const allowed=new Set((available||[]).map(row=>row.user_id))
 const approvedById=new Map((approved||[]).map(row=>[row.id,row.role]))
 const valid=userIds.filter(id=>allowed.has(id)&&approvedById.has(id))
 if(valid.length!==userIds.length)throw new Error('Een selectie is niet langer beschikbaar voor dit evenement.')
 const {error}=await s.from('event_members').upsert(
  valid.map(user_id=>({
   event_id:eventId,
   user_id,
   event_role:approvedById.get(user_id)==='responsible_lead'?'responsible_lead':approvedById.get(user_id)==='admin'?'admin':'employee',
  })),
  {onConflict:'event_id,user_id'}
 )
 check(error)
 await revalidatePath('/events');await revalidatePath('/tasks');await revalidatePath('/briefings');await revalidatePath('/shifts');await revalidatePath('/workplaces')
}
export async function assignAvailableCrewShift(fd:FormData){
 const {s}=await adminClient()
 const eventId=uuid.parse(fd.get('event_id'))
 const userId=uuid.parse(fd.get('user_id'))
 const workplaceId=uuid.parse(fd.get('workplace_id'))
 const [start,end]=dates(fd,'start','end')
 const roleName=text.parse(fd.get('role_name')||'Personeel')
 const shiftKind=z.enum(['event','setup','breakdown']).parse(fd.get('shift_kind')||'event')
 const [
  {data:person,error:personError},
  {data:availability,error:availabilityError},
  {data:workplace,error:workplaceError},
  {data:membership,error:membershipError},
 ]=await Promise.all([
  s.from('profiles').select('id,approved,role').eq('id',userId).single(),
  s.from('event_availability').select('response,setup_available,breakdown_available').eq('event_id',eventId).eq('user_id',userId).maybeSingle(),
  s.from('workplaces').select('id,event_id,is_active').eq('id',workplaceId).single(),
  s.from('event_members').select('user_id').eq('event_id',eventId).eq('user_id',userId).maybeSingle(),
 ])
 check(personError);check(availabilityError);check(workplaceError);check(membershipError)
 if(!person?.approved)throw new Error('Dit account is niet goedgekeurd.')
 const eligible=shiftKind==='event'
  ? availability?.response==='can'
  : shiftKind==='setup'
    ? availability?.setup_available===true
    : availability?.breakdown_available===true
 if(!eligible)throw new Error('Deze persoon heeft voor dit shift-type geen beschikbaarheid bevestigd.')
 if(!workplace||workplace.event_id!==eventId||!workplace.is_active)throw new Error('Selecteer een actieve werkplek van dit evenement.')
 let createdMembershipRole:string|null=null
 if(!membership){
  const eventRole=person.role==='responsible_lead'?'responsible_lead':person.role==='admin'?'admin':'employee'
  const {error:memberError}=await s.from('event_members').insert({event_id:eventId,user_id:userId,event_role:eventRole})
  check(memberError)
  createdMembershipRole=eventRole
 }
 const {error}=await s.rpc('upt_create_shift',{
  p_workplace:workplaceId,
  p_user:userId,
  p_role_name:roleName,
  p_start:start,
  p_end:end,
  p_overlap_allowed:fd.get('overlap_allowed')==='on',
  p_shift_kind:shiftKind,
 })
 if(error&&createdMembershipRole){
  await s.from('event_members')
   .delete()
   .eq('event_id',eventId)
   .eq('user_id',userId)
   .eq('event_role',createdMembershipRole)
 }
 shiftMutationCheck(error)
 await revalidatePath('/events');await revalidatePath('/shifts');await revalidatePath('/workplaces');await revalidatePath('/operations');await revalidatePath('/tasks');await revalidatePath('/briefings')
}
export async function assignResponsible(fd:FormData){
 const {s,user}=await adminClient()
 const workplace_id=uuid.parse(fd.get('workplace_id'))
 const user_id=uuid.parse(fd.get('user_id'))
 const [
  {data:p,error:profileError},
  {data:w,error:wError},
  {data:assignedShifts,error:shiftError},
  {data:allUserShifts,error:allUserShiftsError},
  {data:responsibleAssignments,error:responsibleAssignmentsError},
 ]=await Promise.all([
  s.from('profiles').select('approved,role').eq('id',user_id).single(),
  s.from('workplaces').select('event_id,is_active').eq('id',workplace_id).single(),
  s.from('shifts').select('workplace_id,scheduled_start,scheduled_end').eq('workplace_id',workplace_id).eq('user_id',user_id).neq('status','cancelled').neq('response_status','declined'),
  s.from('shifts').select('workplace_id,scheduled_start,scheduled_end').eq('user_id',user_id).neq('status','cancelled').neq('response_status','declined'),
  s.from('responsible_assignments').select('workplace_id').eq('user_id',user_id),
 ])
 check(profileError);check(wError);check(shiftError);check(allUserShiftsError);check(responsibleAssignmentsError)
 if(!w||!w.is_active)throw new Error('Werkplek niet gevonden of niet actief.')
 if(!p?.approved)throw new Error('Selecteer een goedgekeurd personeelslid.')
 if(!assignedShifts?.length)throw new Error('Deze persoon heeft geen dienst op deze werkplek.')

 const otherResponsibleWorkplaces=new Set(
  (responsibleAssignments||[])
   .map(row=>row.workplace_id)
   .filter(id=>id!==workplace_id)
 )
 const existingResponsibleIntervals=(allUserShifts||[])
  .filter(shift=>otherResponsibleWorkplaces.has(shift.workplace_id))
  .map(shift=>({
   userId:user_id,
   workplaceId:shift.workplace_id,
   startsAt:Date.parse(shift.scheduled_start),
   endsAt:Date.parse(shift.scheduled_end),
  }))
 for(const shift of assignedShifts){
  const candidate={
   userId:user_id,
   workplaceId:workplace_id,
   startsAt:Date.parse(shift.scheduled_start),
   endsAt:Date.parse(shift.scheduled_end),
  }
  if(responsibleHasConflict(candidate,existingResponsibleIntervals)){
   throw new Error('Deze persoon is tijdens deze dienst al verantwoordelijk op een andere werkplek.')
  }
 }

 if(p.role==='staff'){
  const {error:roleError}=await s.rpc('upt_admin_set_account',{
   p_user:user_id,
   p_approved:true,
   p_role:'responsible_lead',
  })
  check(roleError)
 }
 const eventRole=p.role==='admin'?'admin':'responsible_lead'
 const {error:membershipError}=await s.from('event_members').upsert({
  event_id:w.event_id,
  user_id,
  event_role:eventRole,
 },{onConflict:'event_id,user_id'})
 check(membershipError)
 const {error}=await s.from('responsible_assignments').upsert({
  event_id:w.event_id,
  workplace_id,
  user_id,
  assigned_by:user.id,
 },{onConflict:'workplace_id,user_id'})
 check(error)
 await revalidatePath('/workplaces');await revalidatePath('/events');await revalidatePath('/tasks');await revalidatePath('/briefings');await revalidatePath('/operations');await revalidatePath('/personnel')
}
export async function demoteResponsibleToStaff(fd:FormData){
 const {s}=await adminClient()
 const workplaceId=uuid.parse(fd.get('workplace_id'))
 const userId=uuid.parse(fd.get('user_id'))
 const [
  {data:workplace,error:workplaceError},
  {data:profile,error:profileError},
  {data:assignment,error:assignmentError},
 ]=await Promise.all([
  s.from('workplaces').select('event_id').eq('id',workplaceId).single(),
  s.from('profiles').select('role,approved').eq('id',userId).single(),
  s.from('responsible_assignments').select('event_id,workplace_id,user_id').eq('workplace_id',workplaceId).eq('user_id',userId).maybeSingle(),
 ])
 check(workplaceError);check(profileError);check(assignmentError)
 if(!workplace||!assignment)throw new Error('Verantwoordelijke toewijzing niet gevonden.')
 if(profile?.role==='admin')throw new Error('Een beheerder kan hier niet naar personeel worden omgezet.')
 const {error:deleteError}=await s.from('responsible_assignments')
  .delete()
  .eq('workplace_id',workplaceId)
  .eq('user_id',userId)
 check(deleteError)
 const [{data:eventAssignments,error:eventAssignmentsError},{data:allAssignments,error:allAssignmentsError}]=await Promise.all([
  s.from('responsible_assignments').select('workplace_id').eq('event_id',workplace.event_id).eq('user_id',userId).limit(1),
  s.from('responsible_assignments').select('workplace_id').eq('user_id',userId).limit(1),
 ])
 check(eventAssignmentsError);check(allAssignmentsError)
 if(!eventAssignments?.length){
  const {error:membershipError}=await s.from('event_members')
   .update({event_role:'employee'})
   .eq('event_id',workplace.event_id)
   .eq('user_id',userId)
   .eq('event_role','responsible_lead')
  check(membershipError)
 }
 if(profile?.role==='responsible_lead'&&!allAssignments?.length){
  const {error:roleError}=await s.rpc('upt_admin_set_account',{
   p_user:userId,
   p_approved:profile.approved===true,
   p_role:'staff',
  })
  check(roleError)
  const {error:membershipsError}=await s.from('event_members')
   .update({event_role:'employee'})
   .eq('user_id',userId)
   .eq('event_role','responsible_lead')
  check(membershipsError)
 }
 await revalidatePath('/workplaces')
 await revalidatePath('/events')
 await revalidatePath('/operations')
 await revalidatePath('/tasks')
 await revalidatePath('/briefings')
 await revalidatePath('/personnel')
 await revalidatePath('/')
}
export async function createShift(fd:FormData){
 const {s}=await adminClient()
 const [start,end]=dates(fd,'start','end')
 const {error}=await s.rpc('upt_create_shift',{
  p_workplace:uuid.parse(fd.get('workplace_id')),
  p_user:uuid.parse(fd.get('user_id')),
  p_role_name:text.parse(fd.get('role_name')||'Personeel'),
  p_start:start,
  p_end:end,
  p_overlap_allowed:fd.get('overlap_allowed')==='on',
  p_shift_kind:z.enum(['event','setup','breakdown']).parse(fd.get('shift_kind')||'event'),
 })
 shiftMutationCheck(error);await revalidatePath('/shifts');await revalidatePath('/workplaces');await revalidatePath('/operations')
}
export async function updateShift(fd:FormData){
 const {s}=await adminClient()
 const [start,end]=dates(fd,'start','end')
 const {error}=await s.rpc('upt_update_shift',{
  p_shift:uuid.parse(fd.get('shift_id')),
  p_role_name:text.parse(fd.get('role_name')||'Personeel'),
  p_start:start,
  p_end:end,
  p_overlap_allowed:fd.get('overlap_allowed')==='on',
  p_shift_kind:z.enum(['event','setup','breakdown']).parse(fd.get('shift_kind')||'event'),
 })
 shiftMutationCheck(error);await revalidatePath('/shifts');await revalidatePath('/workplaces');await revalidatePath('/operations')
}
export async function confirmShift(fd:FormData){
 const {s}=await approvedClient()
 const {error}=await s.rpc('upt_confirm_shift',{p_shift:uuid.parse(fd.get('shift_id'))})
 shiftMutationCheck(error)
 await revalidatePath('/shifts');await revalidatePath('/workplaces');await revalidatePath('/operations')
}
export async function declineShift(fd:FormData){
 const {s,user}=await approvedClient()
 const shiftId=uuid.parse(fd.get('shift_id'))
 const reason=String(fd.get('reason')||'').trim().slice(0,500)
 if(declineRequiresReason({
  shiftId,
  userId:user.id,
  response:'declined',
  reason,
  updatedAt:Date.now(),
 }))throw new Error('Geef een reden waarom je deze dienst niet kunt uitvoeren.')
 const {error}=await s.rpc('upt_respond_shift',{
  p_shift:shiftId,
  p_response:'declined',
  p_reason:reason,
 })
 check(error)
 await revalidatePath('/shifts');await revalidatePath('/workplaces');await revalidatePath('/operations');await revalidatePath('/notifications')
}
export async function reassignShift(fd:FormData){
 const {s}=await adminClient()
 const reason=z.string().trim().min(3).max(500).parse(fd.get('reason'))
 const {error}=await s.rpc('upt_reassign_shift',{
  p_shift:uuid.parse(fd.get('shift_id')),
  p_user:uuid.parse(fd.get('user_id')),
  p_reason:reason,
 })
 shiftMutationCheck(error)
 await revalidatePath('/shifts');await revalidatePath('/workplaces');await revalidatePath('/operations');await revalidatePath('/notifications')
}
export async function requestShiftReplacement(fd:FormData){
 const {s}=await approvedClient()
 const {error}=await s.rpc('upt_request_shift_change',{
  p_type:'replacement',
  p_shift:uuid.parse(fd.get('shift_id')),
  p_replacement:uuid.parse(fd.get('replacement_user_id')),
  p_reason:z.string().trim().min(3).max(500).parse(fd.get('reason')),
 })
 check(error)
 await revalidatePath('/shifts');await revalidatePath('/notifications')
}
export async function requestShiftSwap(fd:FormData){
 const {s}=await approvedClient()
 const {error}=await s.rpc('upt_request_shift_change',{
  p_type:'swap',
  p_shift:uuid.parse(fd.get('shift_id')),
  p_replacement:uuid.parse(fd.get('replacement_user_id')),
  p_target_shift:uuid.parse(fd.get('target_shift_id')),
  p_reason:z.string().trim().min(3).max(500).parse(fd.get('reason')),
 })
 check(error)
 await revalidatePath('/shifts');await revalidatePath('/notifications')
}
export async function claimOpenShift(fd:FormData){
 const {s}=await approvedClient()
 const {error}=await s.rpc('upt_request_shift_change',{
  p_type:'claim-open-shift',
  p_shift:uuid.parse(fd.get('shift_id')),
  p_reason:z.string().trim().min(3).max(500).parse(fd.get('reason')),
 })
 check(error)
 await revalidatePath('/shifts');await revalidatePath('/notifications')
}
export async function respondShiftChange(fd:FormData){
 const {s}=await approvedClient()
 const {error}=await s.rpc('upt_respond_shift_change',{
  p_request:uuid.parse(fd.get('request_id')),
  p_response:z.enum(['accepted','declined']).parse(fd.get('response')),
 })
 check(error)
 await revalidatePath('/shifts');await revalidatePath('/notifications')
}
export async function cancelShiftChange(fd:FormData){
 const {s}=await approvedClient()
 const {error}=await s.rpc('upt_cancel_shift_change',{
  p_request:uuid.parse(fd.get('request_id')),
 })
 check(error)
 await revalidatePath('/shifts');await revalidatePath('/notifications')
}
export async function decideShiftChange(fd:FormData){
 const {s}=await adminClient()
 const decision=z.enum(['approved','rejected']).parse(fd.get('decision'))
 const reason=String(fd.get('reason')||'').trim().slice(0,500)
 if(decision==='rejected'&&reason.length<3)throw new Error('Geef een reden voor de afwijzing.')
 const {error}=await s.rpc('upt_decide_shift_change',{
  p_request:uuid.parse(fd.get('request_id')),
  p_decision:decision,
  ...(reason?{p_reason:reason}:{}),
 })
 shiftMutationCheck(error)
 await revalidatePath('/shifts');await revalidatePath('/workplaces');await revalidatePath('/operations');await revalidatePath('/notifications')
}

export async function cancelShift(fd:FormData){
 const {s}=await adminClient()
 const reason=String(fd.get('reason')||'').trim().slice(0,500)
 const {error}=await s.rpc('upt_cancel_shift',{p_shift:uuid.parse(fd.get('shift_id')),...(reason?{p_reason:reason}:{})})
 check(error);await revalidatePath('/shifts');await revalidatePath('/workplaces');await revalidatePath('/operations')
}
export async function approvePersonnelAccount(fd:FormData){
 const {s,user}=await adminClient()
 const id=uuid.parse(fd.get('user_id'))
 const role=z.enum(['admin','responsible_lead','staff']).parse(fd.get('role')||'staff')
 if(id===user.id)throw new Error('Je eigen beheeraccount is al goedgekeurd.')
 const {error}=await s.rpc('upt_admin_set_account',{p_user:id,p_approved:true,p_role:role})
 check(error)
 await revalidatePath('/personnel')
 await revalidatePath('/notifications')
 redirect('/personnel?feedback=approved')
}

export async function setAccountStatus(fd:FormData){
 let feedback='role_saved'
 try{
  const {s,user}=await adminClient()
  const id=uuid.parse(fd.get('user_id'))
  const status=z.enum(['pending','approved']).parse(fd.get('status'))
  const approved=status==='approved'
  const role=z.enum(['admin','responsible_lead','staff']).parse(fd.get('role')||'staff')
  if(id===user.id && (!approved||role!=='admin'))throw new Error('Je kunt je eigen beheerderstoegang hier niet intrekken.')
  const {error}=await s.rpc('upt_admin_set_account',{p_user:id,p_approved:approved,p_role:role})
  check(error)
 }catch{
  feedback='role_error'
 }
 await revalidatePath('/personnel')
 await revalidatePath('/notifications')
 redirect(`/personnel?feedback=${feedback}`)
}
export async function acknowledgeBriefing(fd:FormData){const s=await createClient();const {error}=await s.rpc('upt_acknowledge_briefing',{p_briefing:uuid.parse(fd.get('id'))});check(error);await revalidatePath('/briefings')}
export async function acknowledgeInstruction(fd:FormData){const s=await createClient();const {error}=await s.rpc('upt_acknowledge_personal_instruction',{p_instruction:uuid.parse(fd.get('id'))});check(error);await revalidatePath('/briefings')}
export async function createBriefing(fd:FormData){
 const {s,user,profile}=await approvedClient()
 requireManager(profile.role)
 const files=workPhotoFiles(fd)
 const rawWorkplace=String(fd.get('workplace_id')||'').trim()
 const workplaceId=rawWorkplace?uuid.parse(rawWorkplace):null
 let eventId:string
 if(workplaceId){
  const {data:w,error:wError}=await s.from('workplaces').select('event_id').eq('id',workplaceId).single()
  check(wError);if(!w)throw new Error('Werkplek niet gevonden.')
  eventId=w.event_id
 }else{
  eventId=uuid.parse(fd.get('event_id'))
 }
 await requireEventManager(s,user.id,profile.role,eventId)
 await requireFeature(s,profile.role,'briefings',eventId,workplaceId)
 const {data,error}=await s.from('briefings').insert({
  event_id:eventId,
  workplace_id:workplaceId,
  title:text.parse(fd.get('title')),
  body:z.string().trim().min(1).max(20000).parse(fd.get('body')),
  created_by:user.id,
 }).select('id').single()
 check(error);if(!data)throw new Error('Instructie kon niet worden aangemaakt.')
 try{await uploadWorkPhotos(s,user.id,{type:'briefing',id:data.id},files)}
 catch(error){await s.from('briefings').delete().eq('id',data.id);throw error}
 await revalidatePath('/briefings')
}
export async function createPersonalInstruction(fd:FormData){
 const {s,user,profile}=await approvedClient()
 requireManager(profile.role)
 const files=workPhotoFiles(fd)
 const rawWorkplace=String(fd.get('workplace_id')||'').trim()
 const workplaceId=rawWorkplace?uuid.parse(rawWorkplace):null
 let eventId:string
 if(workplaceId){
  const {data:w,error:wError}=await s.from('workplaces').select('event_id').eq('id',workplaceId).single()
  check(wError);if(!w)throw new Error('Werkplek niet gevonden.')
  eventId=w.event_id
 }else{
  eventId=uuid.parse(fd.get('event_id'))
 }
 await requireEventManager(s,user.id,profile.role,eventId)
 await requireFeature(s,profile.role,'briefings',eventId,workplaceId)
 const targetUser=uuid.parse(fd.get('user_id'))
 const {data:member,error:memberError}=await s.from('event_members')
  .select('user_id')
  .eq('event_id',eventId)
  .eq('user_id',targetUser)
  .maybeSingle()
 check(memberError);if(!member)throw new Error('Selecteer personeel dat aan dit evenement is toegewezen.')
 const {data,error}=await s.from('personal_instructions').insert({
  event_id:eventId,
  workplace_id:workplaceId,
  user_id:targetUser,
  title:text.parse(fd.get('title')),
  body:z.string().trim().min(1).max(20000).parse(fd.get('body')),
  created_by:user.id,
 }).select('id').single()
 check(error);if(!data)throw new Error('Persoonlijke instructie kon niet worden aangemaakt.')
 try{await uploadWorkPhotos(s,user.id,{type:'instruction',id:data.id},files)}
 catch(error){await s.from('personal_instructions').delete().eq('id',data.id);throw error}
 await revalidatePath('/briefings')
}
export async function updateBriefing(fd:FormData){
 const {s,user,profile}=await approvedClient()
 requireManager(profile.role)
 const id=uuid.parse(fd.get('id'))
 const {data:current,error:currentError}=await s.from('briefings').select('event_id,workplace_id').eq('id',id).single()
 check(currentError);if(!current)throw new Error('Instructie niet gevonden.')
 await requireEventManager(s,user.id,profile.role,current.event_id)
 await requireFeature(s,profile.role,'briefings',current.event_id,current.workplace_id)
 const files=workPhotoFiles(fd)
 const paths=await uploadWorkPhotos(s,user.id,{type:'briefing',id},files)
 const {error}=await s.from('briefings').update({
  title:text.parse(fd.get('title')),
  body:z.string().trim().min(1).max(20000).parse(fd.get('body')),
 }).eq('id',id)
 if(error){await rollbackWorkPhotos(s,paths);check(error)}
 await revalidatePath('/briefings')
}
export async function updatePersonalInstruction(fd:FormData){
 const {s,user,profile}=await approvedClient()
 requireManager(profile.role)
 const id=uuid.parse(fd.get('id'))
 const {data:current,error:currentError}=await s.from('personal_instructions').select('event_id,workplace_id').eq('id',id).single()
 check(currentError);if(!current)throw new Error('Persoonlijke instructie niet gevonden.')
 await requireEventManager(s,user.id,profile.role,current.event_id)
 await requireFeature(s,profile.role,'briefings',current.event_id,current.workplace_id)
 const files=workPhotoFiles(fd)
 const paths=await uploadWorkPhotos(s,user.id,{type:'instruction',id},files)
 const {error}=await s.from('personal_instructions').update({
  title:text.parse(fd.get('title')),
  body:z.string().trim().min(1).max(20000).parse(fd.get('body')),
 }).eq('id',id)
 if(error){await rollbackWorkPhotos(s,paths);check(error)}
 await revalidatePath('/briefings')
}
export async function createInventoryItem(fd:FormData){
 const {s,profile}=await approvedClient()
 requireManager(profile.role)
 const {error}=await s.rpc('upt_create_inventory_item',{
  p_workplace:uuid.parse(fd.get('workplace_id')),
  p_name:text.parse(fd.get('name')),
  p_category:String(fd.get('category')||'').trim().slice(0,120)||undefined,
  p_quantity:z.coerce.number().int().min(1).max(100000).parse(fd.get('quantity')),
  p_item_kind:z.enum(['asset','consumable']).parse(fd.get('item_kind')||'consumable'),
 })
 check(error)
 await revalidatePath('/workplaces');await revalidatePath('/tasks');await revalidatePath('/operations');await revalidatePath('/inventory')
}
export async function reportWorkplaceInventoryCondition(fd:FormData){
 const {s,profile}=await approvedClient()
 if(!['admin','responsible_lead'].includes(profile.role))throw new Error('Alleen admin of verantwoordelijke kan materiaal controleren.')
 const {error}=await s.rpc('upt_report_workplace_inventory_condition',{
  p_item:uuid.parse(fd.get('item_id')),
  p_phase:z.enum(['opening','closing']).parse(fd.get('phase')),
  p_condition:z.enum(['damaged','missing']).parse(fd.get('condition')),
  p_quantity:z.coerce.number().int().min(1).max(100000).parse(fd.get('quantity')),
  p_notes:String(fd.get('notes')||'').trim().slice(0,1000)||undefined,
 })
 check(error)
 await revalidatePath('/inventory');await revalidatePath('/workplaces');await revalidatePath('/notifications')
}
export async function restockInventoryItem(fd:FormData){
 const {s,profile}=await approvedClient()
 requireManager(profile.role)
 const {error}=await s.rpc('upt_restock_inventory_item',{
  p_item:uuid.parse(fd.get('item_id')),
  p_quantity:z.coerce.number().int().min(1).max(100000).parse(fd.get('quantity')),
  p_notes:String(fd.get('notes')||'').trim().slice(0,1000)||undefined,
 })
 check(error)
 await revalidatePath('/workplaces');await revalidatePath('/tasks');await revalidatePath('/operations');await revalidatePath('/inventory')
}
export async function issueInventoryItem(fd:FormData){
 const {s,profile}=await approvedClient()
 requireManager(profile.role)
 const {error}=await s.rpc('upt_issue_inventory',{
  p_item:uuid.parse(fd.get('item_id')),
  p_user:uuid.parse(fd.get('user_id')),
  p_quantity:z.coerce.number().int().min(1).max(100000).parse(fd.get('quantity')),
  p_notes:String(fd.get('notes')||'').trim().slice(0,1000)||undefined,
 })
 check(error)
 await revalidatePath('/workplaces');await revalidatePath('/tasks');await revalidatePath('/operations');await revalidatePath('/notifications')
}
export async function settleInventoryIssue(fd:FormData){
 const {s}=await approvedClient()
 const {error}=await s.rpc('upt_settle_inventory_issue',{
  p_issue:uuid.parse(fd.get('issue_id')),
  p_condition:z.enum(['returned','damaged','missing']).parse(fd.get('condition')),
  p_quantity:z.coerce.number().int().min(1).max(100000).parse(fd.get('quantity')),
  p_notes:String(fd.get('notes')||'').trim().slice(0,1000)||undefined,
 })
 check(error)
 await revalidatePath('/workplaces');await revalidatePath('/tasks');await revalidatePath('/operations');await revalidatePath('/notifications')
}
export async function requestInventorySettlement(fd:FormData){
 const {s}=await approvedClient()
 const {error}=await s.rpc('upt_request_inventory_settlement',{
  p_issue:uuid.parse(fd.get('issue_id')),
  p_condition:z.enum(['returned','damaged','missing']).parse(fd.get('condition')),
  p_quantity:z.coerce.number().int().min(1).max(100000).parse(fd.get('quantity')),
  p_notes:String(fd.get('notes')||'').trim().slice(0,1000)||undefined,
 })
 check(error)
 await revalidatePath('/workplaces');await revalidatePath('/tasks');await revalidatePath('/operations');await revalidatePath('/notifications')
}
export async function cancelInventorySettlement(fd:FormData){
 const {s}=await approvedClient()
 const {error}=await s.rpc('upt_cancel_inventory_settlement',{
  p_request:uuid.parse(fd.get('request_id')),
 })
 check(error)
 await revalidatePath('/workplaces');await revalidatePath('/tasks');await revalidatePath('/operations')
}
export async function decideInventorySettlement(fd:FormData){
 const {s,profile}=await approvedClient()
 requireManager(profile.role)
 const decision=z.enum(['approved','rejected']).parse(fd.get('decision'))
 const note=String(fd.get('note')||'').trim().slice(0,1000)
 if(decision==='rejected'&&note.length<3)throw new Error('Geef een reden voor de afwijzing.')
 const {error}=await s.rpc('upt_decide_inventory_settlement',{
  p_request:uuid.parse(fd.get('request_id')),
  p_decision:decision,
  ...(note?{p_note:note}:{}),
 })
 check(error)
 await revalidatePath('/workplaces');await revalidatePath('/tasks');await revalidatePath('/operations');await revalidatePath('/notifications')
}
export async function restoreInventoryQuantity(fd:FormData){
 const {s,profile}=await approvedClient()
 requireManager(profile.role)
 const {error}=await s.rpc('upt_restore_inventory_quantity',{
  p_item:uuid.parse(fd.get('item_id')),
  p_condition:z.enum(['damaged','missing']).parse(fd.get('condition')),
  p_quantity:z.coerce.number().int().min(1).max(100000).parse(fd.get('quantity')),
  p_notes:String(fd.get('notes')||'').trim().slice(0,1000)||undefined,
 })
 check(error)
 await revalidatePath('/workplaces');await revalidatePath('/tasks');await revalidatePath('/operations');await revalidatePath('/inventory')
}

const checklistPhotoTypes=new Map([
 ['image/jpeg','jpg'],
 ['image/png','png'],
 ['image/webp','webp'],
])

export async function createOperationalChecklist(fd:FormData){
 const {s,profile}=await approvedClient()
 requireManager(profile.role)
 const workplaceId=uuid.parse(fd.get('workplace_id'))
 const {data:workplace,error:workplaceError}=await s.from('workplaces').select('event_id').eq('id',workplaceId).single()
 check(workplaceError)
 if(!workplace)throw new Error('Werkplek niet gevonden.')
 const {error}=await s.rpc('upt_create_operational_checklist',{
  p_event:workplace.event_id,
  p_workplace:workplaceId,
  p_kind:z.enum(['opening','closing','safety','custom']).parse(fd.get('kind')),
  p_title:text.parse(fd.get('title')),
  p_description:String(fd.get('description')||'').trim().slice(0,2000),
 })
 check(error)
 await revalidatePath('/tasks');await revalidatePath('/workplaces');await revalidatePath('/inventory')
}
export async function addOperationalChecklistItem(fd:FormData){
 const {s,profile}=await approvedClient()
 requireManager(profile.role)
 const {error}=await s.rpc('upt_add_operational_checklist_item',{
  p_checklist:uuid.parse(fd.get('checklist_id')),
  p_label:z.string().trim().min(1).max(300).parse(fd.get('label')),
  p_required:fd.get('required')==='on',
  p_requires_photo:fd.get('requires_photo')==='on',
 })
 check(error)
 await revalidatePath('/tasks');await revalidatePath('/workplaces');await revalidatePath('/inventory')
}
export async function removeOperationalChecklistItem(fd:FormData){
 const {s,profile}=await approvedClient()
 requireManager(profile.role)
 const itemId=uuid.parse(fd.get('item_id'))
 const {data:item,error:itemError}=await s.from('checklist_items').select('photo_path').eq('id',itemId).maybeSingle()
 check(itemError)
 const {error}=await s.rpc('upt_remove_operational_checklist_item',{
  p_item:itemId,
 })
 check(error)
 if(item?.photo_path)await s.storage.from('work-media').remove([item.photo_path])
 await revalidatePath('/tasks');await revalidatePath('/workplaces');await revalidatePath('/inventory')
}
export async function completeOperationalChecklistItem(fd:FormData){
 const {s,user}=await approvedClient()
 const itemId=uuid.parse(fd.get('item_id'))
 const raw=fd.get('photo')
 const photo=raw instanceof File&&raw.size>0?raw:null
 let uploaded:string|null=null
 if(photo){
  const ext=checklistPhotoTypes.get(photo.type)
  if(!ext)throw new Error('Gebruik een JPEG-, PNG- of WebP-foto.')
  if(photo.size>10*1024*1024)throw new Error('Checklistfoto mag maximaal 10 MB zijn.')
  uploaded=`${user.id}/checklist/${itemId}/${crypto.randomUUID()}.${ext}`
  const {error:uploadError}=await s.storage.from('work-media').upload(uploaded,photo,{contentType:photo.type,upsert:false})
  if(uploadError)throw new Error('Checklistfoto uploaden mislukt.')
 }
 const {error}=await s.rpc('upt_set_operational_checklist_item',{
  p_item:itemId,
  p_complete:true,
  ...(uploaded?{p_photo_path:uploaded}:{}),
 })
 if(error&&uploaded)await s.storage.from('work-media').remove([uploaded])
 check(error)
 await revalidatePath('/tasks');await revalidatePath('/workplaces');await revalidatePath('/inventory')
}
export async function reopenOperationalChecklistItem(fd:FormData){
 const {s}=await approvedClient()
 const itemId=uuid.parse(fd.get('item_id'))
 const {data:item,error:itemError}=await s.from('checklist_items').select('photo_path').eq('id',itemId).maybeSingle()
 check(itemError)
 const {error}=await s.rpc('upt_set_operational_checklist_item',{
  p_item:itemId,
  p_complete:false,
 })
 check(error)
 if(item?.photo_path)await s.storage.from('work-media').remove([item.photo_path])
 await revalidatePath('/tasks');await revalidatePath('/workplaces');await revalidatePath('/inventory')
}
export async function closeOperationalChecklist(fd:FormData){
 const {s,profile}=await approvedClient()
 requireManager(profile.role)
 const {error}=await s.rpc('upt_close_operational_checklist',{
  p_checklist:uuid.parse(fd.get('checklist_id')),
 })
 check(error)
 await revalidatePath('/tasks');await revalidatePath('/workplaces');await revalidatePath('/inventory')
}
export async function reopenOperationalChecklist(fd:FormData){
 const {s,profile}=await approvedClient()
 requireManager(profile.role)
 const {error}=await s.rpc('upt_reopen_operational_checklist',{
  p_checklist:uuid.parse(fd.get('checklist_id')),
 })
 check(error)
 await revalidatePath('/tasks');await revalidatePath('/workplaces');await revalidatePath('/inventory')
}

export async function createTask(fd:FormData){
 const {s,user,profile}=await approvedClient()
 requireManager(profile.role)
 const files=workPhotoFiles(fd)
 const rawWorkplace=String(fd.get('workplace_id')||'').trim()
 let eventId:string
 let workplaceId:string|null=null
 if(rawWorkplace){
  workplaceId=uuid.parse(rawWorkplace)
  const {data:w,error:wError}=await s.from('workplaces').select('event_id,is_active').eq('id',workplaceId).single()
  check(wError);if(!w||!w.is_active)throw new Error('Werkplek niet gevonden.')
  eventId=w.event_id
 }else{
  eventId=uuid.parse(fd.get('event_id'))
 }
 if(profile.role==='responsible_lead'){
  if(!workplaceId)throw new Error('Kies je toegewezen werkplek.')
  const {data:assignment,error:assignmentError}=await s.from('responsible_assignments')
   .select('workplace_id')
   .eq('event_id',eventId)
   .eq('workplace_id',workplaceId)
   .eq('user_id',user.id)
   .maybeSingle()
  check(assignmentError)
  if(!assignment)throw new Error('Je kunt alleen taken beheren binnen je eigen toegewezen werkplek.')
 }else{
  await requireEventManager(s,user.id,profile.role,eventId)
 }
 await requireFeature(s,profile.role,'tasks',eventId,workplaceId)
 const userIds=[...new Set(fd.getAll('user_id').map(value=>uuid.parse(value)))]
 if(!userIds.length)throw new Error('Selecteer minstens één medewerker.')
 const [{data:members,error:memberError},{data:available,error:availabilityError}]=await Promise.all([
  s.from('event_members').select('user_id').eq('event_id',eventId).in('user_id',userIds),
  s.from('event_availability').select('user_id').eq('event_id',eventId).eq('response','can').in('user_id',userIds),
 ])
 check(memberError);check(availabilityError)
 const memberIds=new Set((members||[]).map(row=>row.user_id))
 const availableIds=new Set((available||[]).map(row=>row.user_id))
 if(userIds.some(id=>!memberIds.has(id)||!availableIds.has(id)))throw new Error('Selecteer alleen toegevoegde medewerkers die hebben aangeduid dat ze kunnen.')
 if(profile.role==='responsible_lead'&&workplaceId){
  const {data:workplaceShifts,error:shiftError}=await s.from('shifts')
   .select('user_id')
   .eq('event_id',eventId)
   .eq('workplace_id',workplaceId)
   .neq('status','cancelled')
   .in('user_id',userIds)
  check(shiftError)
  const workplaceUserIds=new Set((workplaceShifts||[]).map(row=>row.user_id))
  if(userIds.some(id=>!workplaceUserIds.has(id)))throw new Error('Selecteer alleen personeel dat aan jouw werkplek is toegewezen.')
 }
 const [first,...rest]=userIds
 const {data:taskId,error}=await s.rpc('upt_create_assigned_task',{
  p_event:eventId,
  p_workplace:workplaceId as unknown as string,
  p_user:first,
  p_title:text.parse(fd.get('title')),
  p_description:String(fd.get('description')||'').slice(0,4000),
 })
 check(error);if(!taskId)throw new Error('Taak kon niet worden aangemaakt.')
 try{
  for(const target of rest){
   const {error:assignError}=await s.rpc('upt_assign_task',{p_task:taskId,p_user:target})
   check(assignError)
  }
  await uploadWorkPhotos(s,user.id,{type:'task',id:taskId},files)
 }catch(error){
  await s.from('tasks').delete().eq('id',taskId)
  throw error
 }
 await revalidatePath('/tasks')
}
export async function removeTaskAssignment(fd:FormData){
 const {s,user,profile}=await approvedClient()
 requireManager(profile.role)
 const assignmentId=uuid.parse(fd.get('assignment_id'))
 const {data:assignment,error:assignmentError}=await s.from('task_assignments').select('tasks(event_id,workplace_id)').eq('id',assignmentId).single()
 check(assignmentError)
 const task=assignment?.tasks
 if(!task)throw new Error('Taaktoewijzing niet gevonden.')

 if(profile.role==='responsible_lead'){
  if(!task.workplace_id)throw new Error('Je kunt alleen taken beheren binnen je eigen toegewezen werkplek.')

  const {data:responsibleAssignment,error:responsibleError}=await s.from('responsible_assignments')
   .select('workplace_id')
   .eq('event_id',task.event_id)
   .eq('workplace_id',task.workplace_id)
   .eq('user_id',user.id)
   .maybeSingle()

  check(responsibleError)

  if(!responsibleAssignment){
   throw new Error('Je kunt alleen taken beheren binnen je eigen toegewezen werkplek.')
  }
 }else{
  await requireEventManager(s,user.id,profile.role,task.event_id)
 }

 await requireFeature(s,profile.role,'tasks',task.event_id,task.workplace_id)

 const {error}=await s.rpc('upt_remove_task_assignment',{
  p_assignment:assignmentId,
 })

 check(error)
 await revalidatePath('/tasks')
}

export async function saveShiftHandover(fd:FormData){
 const {s,profile}=await approvedClient()
 if(profile.role!=='responsible_lead')throw new Error('Alleen een verantwoordelijke kan een overdracht voorbereiden.')
 const incomingRaw=String(fd.get('incoming_user_id')||'').trim()
 const incoming=incomingRaw?uuid.parse(incomingRaw):undefined
 const markReady=String(fd.get('mark_ready')||'false')==='true'
 if(markReady&&!incoming)throw new Error('Selecteer eerst een inkomende verantwoordelijke.')
 const equipmentNotes=String(fd.get('equipment_notes')||'').trim().slice(0,2000)
 const notes=String(fd.get('notes')||'').trim().slice(0,4000)
 const {error}=await s.rpc('upt_save_shift_handover',{
  p_event:uuid.parse(fd.get('event_id')),
  p_workplace:uuid.parse(fd.get('workplace_id')),
  p_incoming:incoming,
  p_equipment_notes:equipmentNotes||undefined,
  p_notes:notes||undefined,
  p_mark_ready:markReady,
 })
 check(error)
 await revalidatePath('/operations');await revalidatePath('/notifications')
}
export async function acceptShiftHandover(fd:FormData){
 const {s,profile}=await approvedClient()
 if(profile.role!=='responsible_lead')throw new Error('Alleen een verantwoordelijke kan een overdracht accepteren.')
 const {error}=await s.rpc('upt_accept_shift_handover',{
  p_handover:uuid.parse(fd.get('handover_id')),
 })
 check(error)
 await revalidatePath('/operations');await revalidatePath('/notifications')
}

export async function markNotificationRead(fd:FormData){
 const s=await createClient()
 const {error}=await s.rpc('upt_mark_notification_read',{p_notification:uuid.parse(fd.get('notification_id'))})
 check(error);await revalidatePath('/notifications')
}
export async function archiveEvent(fd:FormData){const {s}=await adminClient();const {error}=await s.from('events').update({status:'archived'}).eq('id',uuid.parse(fd.get('event_id')));check(error);await revalidatePath('/events')}
export async function duplicateEvent(fd:FormData){const {s}=await adminClient();const [start,end]=dates(fd,'start_at','end_at');const {error}=await s.rpc('upt_duplicate_event',{p_event:uuid.parse(fd.get('event_id')),p_name:text.parse(fd.get('name')),p_start:start,p_end:end});check(error);await revalidatePath('/events')}
export async function createEventDocument(fd:FormData){
 const {s,user,profile}=await approvedClient()
 requireManager(profile.role)
 const fileValue=fd.get('document')
 if(!(fileValue instanceof File)||fileValue.size<=0)throw new Error('Kies een document.')
 const ext=eventDocumentTypes.get(fileValue.type)
 if(!ext)throw new Error('Gebruik alleen PDF, DOCX, PPTX, XLSX, TXT, CSV, JPG, PNG of WEBP.')
 const max=fileValue.type.startsWith('image/')?10*1024*1024:20*1024*1024
 if(fileValue.size>max)throw new Error(fileValue.type.startsWith('image/')?'Afbeelding mag maximaal 10 MB zijn.':'Document mag maximaal 20 MB zijn.')
 const eventId=uuid.parse(fd.get('event_id'))
 const workplaceRaw=String(fd.get('workplace_id')||'').trim()
 const workplaceId=workplaceRaw?uuid.parse(workplaceRaw):undefined
 if(profile.role==='responsible_lead'&&!workplaceId)throw new Error('Verantwoordelijke documenten moeten aan een toegewezen werkplek gekoppeld zijn.')
 const storagePath=`${user.id}/document/${crypto.randomUUID()}.${ext}`
 const {error:uploadError}=await s.storage.from('work-media').upload(storagePath,fileValue,{contentType:fileValue.type,upsert:false})
 if(uploadError)throw new Error('Document uploaden mislukt.')
 const {error}=await s.rpc('upt_create_event_document',{
  p_event:eventId,
  p_workplace:(workplaceId??null) as unknown as string,
  p_kind:z.enum(['briefing','safety','map','procedure','permit','technical','crew']).parse(fd.get('kind')),
  p_audience:z.enum(['employee','responsible','admin']).parse(fd.get('audience')),
  p_title:text.parse(fd.get('title')),
  p_description:String(fd.get('description')||'').trim().slice(0,2000),
  p_storage_path:storagePath,
  p_file_name:fileValue.name.slice(0,255),
  p_mime_type:fileValue.type,
  p_file_size_bytes:fileValue.size,
  p_offline_critical:fd.get('offline_critical')==='on',
 })
 if(error)await s.storage.from('work-media').remove([storagePath])
 check(error)
 await revalidatePath('/events');await revalidatePath('/inventory');await revalidatePath('/notifications')
}
export async function createInventoryTextEntry(fd:FormData){
 const {s,user}=await adminClient()
 const eventId=uuid.parse(fd.get('event_id'))
 const workplaceId=uuid.parse(fd.get('workplace_id'))
 const title=text.parse(fd.get('title'))
 const content=z.string().trim().min(1).max(12000).parse(fd.get('content'))
 const {data:workplace,error:workplaceError}=await s.from('workplaces').select('event_id,is_active').eq('id',workplaceId).single()
 check(workplaceError)
 if(!workplace?.is_active||workplace.event_id!==eventId)throw new Error('Werkplek niet gevonden.')
 const storagePath=`${user.id}/document/${crypto.randomUUID()}.txt`
 const body=new Blob([content],{type:'text/plain'})
 const {error:uploadError}=await s.storage.from('work-media').upload(storagePath,body,{contentType:'text/plain',upsert:false})
 if(uploadError)throw new Error('Tekst opslaan mislukt.')
 const {error}=await s.rpc('upt_create_event_document',{
  p_event:eventId,
  p_workplace:workplaceId,
  p_kind:'technical',
  p_audience:'employee',
  p_title:title,
  p_description:content.slice(0,2000),
  p_storage_path:storagePath,
  p_file_name:`${title.replace(/[^a-z0-9-_]+/gi,'-').slice(0,80)||'inventaris'}.txt`,
  p_mime_type:'text/plain',
  p_file_size_bytes:new TextEncoder().encode(content).byteLength,
  p_offline_critical:true,
 })
 if(error){
  await s.storage.from('work-media').remove([storagePath])
  check(error)
 }
 await revalidatePath('/inventory');await revalidatePath('/workplaces')
}

export async function archiveEventDocument(fd:FormData){
 const {s,profile}=await approvedClient()
 requireManager(profile.role)
 const {data:path,error}=await s.rpc('upt_archive_event_document',{p_document:uuid.parse(fd.get('document_id'))})
 check(error)
 if(path)await s.storage.from('work-media').remove([path])
 await revalidatePath('/events');await revalidatePath('/inventory')
}

export async function updateEventEmergencyInformation(fd:FormData){
 const {s}=await adminClient()
 const {error}=await s.rpc('upt_upsert_event_emergency_information',{
  p_event:uuid.parse(fd.get('event_id')),
  p_emergency_number:String(fd.get('emergency_number')||'').trim().slice(0,40),
  p_first_aid_contact:String(fd.get('first_aid_contact')||'').trim().slice(0,300)||undefined,
  p_security_contact:String(fd.get('security_contact')||'').trim().slice(0,300)||undefined,
  p_assembly_point:String(fd.get('assembly_point')||'').trim().slice(0,500)||undefined,
  p_procedure:String(fd.get('procedure')||'').trim().slice(0,5000)||undefined,
 })
 check(error)
 await revalidatePath('/events');await revalidatePath('/incidents');await revalidatePath('/')
}
export async function updateEvent(fd:FormData){
 const {s}=await adminClient()
 const [start,end]=dates(fd,'start_at','end_at')
 const registrationDeadline=optionalIso(fd,'registration_deadline')||start
 const maxJoiners=optionalPositiveInt(fd,'max_joiners')
 if(Date.parse(registrationDeadline)>Date.parse(start))throw new Error('De aanmelddeadline moet vóór of op de start van het evenement liggen.')
 const location=await eventLocation(fd)
 const {error}=await s.from('events').update({
  name:text.parse(fd.get('name')),
  venue:location.venue,
  address:location.address,
  latitude:location.latitude,longitude:location.longitude,
  start_at:start,end_at:end,start_date:start,end_date:end,
  registration_deadline:registrationDeadline,
  max_joiners:maxJoiners,
  checkin_radius_m:z.coerce.number().int().min(10).max(10000).parse(fd.get('radius')),
 }).eq('id',uuid.parse(fd.get('event_id')))
 check(error);await revalidatePath('/events')
}
export async function deleteEvent(fd:FormData){
 const {s}=await adminClient()
 const eventId=uuid.parse(fd.get('event_id'))
 const {error}=await s.from('events').delete().eq('id',eventId)
 check(error);await revalidatePath('/events')
}