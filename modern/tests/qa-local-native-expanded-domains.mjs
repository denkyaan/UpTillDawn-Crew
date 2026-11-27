// Phase 2+3: independent positive workflows in the same disposable DB run.
// No service role for actions, no live providers, no synthetic success results.
import assert from 'node:assert/strict'
import {runFinalDomains} from './qa-local-native-final-domains.mjs'
import {nativeAdminActionResponse as admin} from '../src/api/native-admin-actions.ts'
import {nativeCatalogActionResponse as catalog} from '../src/api/native-catalog-event-actions.ts'
import {nativeWaveTwoActionResponse as platformAction} from '../src/api/native-platform-actions.ts'
import {nativeWaveThreeActionResponse as shiftAction} from '../src/api/native-event-shift-actions.ts'
import {nativeInventoryActionResponse as inventory} from '../src/api/native-inventory-checklist-actions.ts'
import {megaCrewEventResponse as crewEvent} from '../src/api/native-mega-crew-event-actions.ts'
import {megaOperationsResponse as operations} from '../src/api/native-mega-operations-actions.ts'
import {finalCrewActionResponse as finalCrew} from '../src/api/native-final-crew-actions.ts'
import {finalAdminDetailsResponse as details} from '../src/api/native-final-admin-details.ts'
import {finalOperationsActionResponse as officeAction} from '../src/api/native-final-operations-actions.ts'
import {finalAgreementsResponse as agreements} from '../src/api/native-final-agreements-actions.ts'
import {finalFinanceResponse as financeAction} from '../src/api/native-final-finance-actions.ts'

export async function runRemainingDomains(c){
 const {head,staff,office,promoter,unrelated,alternate,event,workplace,prefix,a,read,one,find,sqlLocal,invoke,denied,verified,domain,crew,platform,finance,saved,ownProfile}=c
 const eventId=name=>'lib/actions/events.ts#'+name
 const cat=name=>'lib/actions/workplace-catalog.ts#'+name
 const ap='app/(app)/portals/administration/'
 const component=(file,name)=>'components/administration/'+file+'.tsx#'+name
 const counter=name=>ap+'counterparties/page.tsx#'+name
 const booking=name=>ap+'modules/artists/[id]/page.tsx#'+name
 const newBooking=ap+'modules/artists/new/page.tsx#createBooking'
 const agreement=name=>ap+'modules/artists/[id]/agreement/page.tsx#'+name
 const module=name=>ap+'modules/[slug]/page.tsx#'+name
 const taskAction=name=>'app/(app)/admin/management/event-tasks/page.tsx#'+name
 const promotionAdmin=name=>ap+'promotion-tasks/page.tsx#'+name
 const dateRange=(days=18)=>{
  const start_at=new Date(Date.now()+days*86400000).toISOString()
  return {start_at,end_at:new Date(Date.parse(start_at)+4*3600000).toISOString()}
 }
 const newEvent=async(label,days=18)=>{
  const name=prefix+' '+label,dates=dateRange(days)
  await invoke(crewEvent,head,crew('createEvent'),{name,...dates,radius:'100'})
  return {...await one(a.from('events').select('id,status').eq('name',name),'NEW_EVENT'),...dates,name}
 }
 const newPost=async(e,label,extra={})=>{
  const name=prefix+' '+label
  await invoke(crewEvent,head,crew('addWorkplace'),{event_id:e.id,name,default_shift_start:e.start_at,default_shift_end:e.end_at,...extra})
  return one(a.from('workplaces').select('id,name').eq('event_id',e.id).eq('name',name),'NEW_POST')
 }
 const available=async(e,who)=>{
  await read(who.db.rpc('upt_set_event_availability_with_reason',{p_event:e.id,p_response:'can',p_setup:false,p_breakdown:false}),'AVAIL_FIXTURE')
 }
 const member=async(e,who)=>{
  await available(e,who)
  await read(a.from('event_members').insert({event_id:e.id,user_id:who.id,event_role:'employee'}),'MEMBER_FIXTURE')
 }
 const status=async(id)=>{
  assert.match(id,/^[0-9a-f-]{36}$/i)
  return sqlLocal("SELECT status FROM public.events WHERE id='"+id+"'::uuid")
 }
 await domain('event-close-archive-restore',async()=>{
  const future=await newEvent('Future closure denial')
  const e=await newEvent('Archive lifecycle',-0.01)
  const fields={event_id:e.id,reason:prefix+' authorized test'}
  await verified(eventId('closeEvent'),async()=>{
   await denied(shiftAction,staff,eventId('closeEvent'),{...fields,force:'on'})
   await denied(shiftAction,head,eventId('closeEvent'),{event_id:future.id,force:'on',reason:prefix+' premature'})
   assert.notEqual(await status(future.id),'closed')
   await denied(shiftAction,head,eventId('closeEvent'),fields)
   assert.notEqual(await status(e.id),'closed')
   await invoke(shiftAction,head,eventId('closeEvent'),{...fields,force:'on'})
   assert.equal(await status(e.id),'closed')
  })
  await verified(eventId('archiveEvent'),async()=>{
   await invoke(shiftAction,head,eventId('archiveEvent'),fields)
   assert.equal(await status(e.id),'archived')
  })
  await verified(eventId('restoreEvent'),async()=>{
   await invoke(shiftAction,head,eventId('restoreEvent'),fields)
   assert.equal(await status(e.id),'closed')
  })
  await verified(eventId('archiveEventWithState'),async()=>{
   await invoke(crewEvent,head,eventId('archiveEventWithState'),fields,{state:true})
   assert.equal(await status(e.id),'archived')
  })
  await verified(eventId('restoreEventWithState'),async()=>{
   await invoke(crewEvent,head,eventId('restoreEventWithState'),fields,{state:true})
   assert.equal(await status(e.id),'closed')
  })
  await verified(crew('archiveEvent'),async()=>{
   await invoke(catalog,head,crew('archiveEvent'),fields)
   assert.equal(await status(e.id),'archived')
   await invoke(shiftAction,head,eventId('restoreEvent'),fields)
  })
  await verified(crew('deleteEvent'),async()=>{
   await invoke(catalog,head,crew('deleteEvent'),fields)
   assert.equal(await status(e.id),'archived','LEGACY_DELETE_IS_ARCHIVE')
  })
 })
 await domain('event-template-duplication',async()=>{
  const e=await newEvent('Template source',19),post=await newPost(e,'Template custom post')
  const verifyClone=async(name)=>{
   const copy=await one(a.from('events').select('id,created_by').eq('name',name),'CLONE')
   assert.notEqual(copy.id,e.id);assert.equal(copy.created_by,head.id)
   const w=await one(a.from('workplaces').select('id').eq('event_id',copy.id).eq('name',post.name),'CLONED_POST')
   assert.notEqual(w.id,post.id)
   const seeded=await read(a.from('workplaces').select('name,catalog_workplace_id').eq('event_id',copy.id),'CLONED_CATALOG_POSTS')
   assert.equal(new Set(seeded.map(r=>r.name)).size,seeded.length)
   assert.ok(seeded.some(r=>r.catalog_workplace_id))
  }
  let t1,t2
  await verified(eventId('captureEventTemplate'),async()=>{
   const name=prefix+' Event template'
   await invoke(catalog,head,eventId('captureEventTemplate'),{event_id:e.id,template_name:name,section_workplaces:'on'})
   t1=await one(a.from('event_templates').select('id,source_event_id,sections,configuration').eq('name',name),'EVENT_TEMPLATE')
   assert.equal(t1.source_event_id,e.id);assert.ok(t1.sections.includes('workplaces'))
   assert.ok(t1.configuration.workplaces.some(x=>x.name===post.name))
  })
  await verified(platform('captureEventTemplate'),async()=>{
   const name=prefix+' Platform template'
   await invoke(platformAction,head,platform('captureEventTemplate'),{event_id:e.id,name,section:['workplaces']})
   t2=await one(a.from('event_templates').select('id,source_event_id,configuration').eq('name',name),'PLATFORM_TEMPLATE')
   assert.equal(t2.source_event_id,e.id);assert.ok(t2.configuration.workplaces.some(x=>x.name===post.name))
  })
  await verified(eventId('applyEventTemplate'),async()=>{
   const name=prefix+' Event template clone'
   await invoke(catalog,head,eventId('applyEventTemplate'),{template_id:t1.id,name,...dateRange(20)})
   await verifyClone(name)
  })
  await verified(platform('applyEventTemplate'),async()=>{
   const name=prefix+' Platform template clone'
   await invoke(platformAction,head,platform('applyEventTemplate'),{template_id:t2.id,name,...dateRange(21)})
   await verifyClone(name)
  })
  await verified(crew('duplicateEvent'),async()=>{
   const name=prefix+' Duplicate event'
   await invoke(catalog,head,crew('duplicateEvent'),{event_id:e.id,name,...dateRange(22)})
   await verifyClone(name)
  })
 })
 await domain('workplace-catalog-lifecycle',async()=>{
  const e=await newEvent('Catalog target',23),name=prefix+' Catalog post'
  let post,item
  await verified(cat('createCatalogWorkplace'),async()=>{
   const fields={name,minimum_staff:'1',target_staff:'2',maximum_staff:'4',sort_order:'77'}
   await denied(catalog,staff,cat('createCatalogWorkplace'),fields)
   await invoke(catalog,head,cat('createCatalogWorkplace'),fields)
   post=await one(a.from('workplace_catalog').select('id,minimum_staff,target_staff,maximum_staff').eq('name',name),'CATALOG_POST')
   assert.equal(post.minimum_staff,1);assert.equal(post.target_staff,2);assert.equal(post.maximum_staff,4)
  })
  await verified(cat('updateCatalogWorkplace'),async()=>{
   await invoke(catalog,head,cat('updateCatalogWorkplace'),{workplace_id:post.id,name,minimum_staff:'1',target_staff:'3',maximum_staff:'5',sort_order:'78',is_active:'on'})
   const r=await find('workplace_catalog',post.id,'target_staff,maximum_staff,sort_order,is_active')
   assert.equal(r.target_staff,3);assert.equal(r.maximum_staff,5);assert.equal(r.sort_order,78);assert.equal(r.is_active,true)
  })
  await verified(cat('createCatalogItem'),async()=>{
   await invoke(catalog,head,cat('createCatalogItem'),{workplace_id:post.id,name:prefix+' Catalog stock',quantity:'4',category:'QA'})
   item=await one(a.from('workplace_catalog_items').select('id,default_quantity').eq('catalog_workplace_id',post.id).eq('name',prefix+' Catalog stock'),'CATALOG_ITEM')
   assert.equal(item.default_quantity,4)
  })
  await verified(cat('updateCatalogItem'),async()=>{
   await invoke(catalog,head,cat('updateCatalogItem'),{item_id:item.id,name:prefix+' Catalog stock edited',quantity:'6',category:'QA',is_active:'on'})
   const r=await find('workplace_catalog_items',item.id,'name,default_quantity,is_active')
   assert.equal(r.name,prefix+' Catalog stock edited');assert.equal(r.default_quantity,6);assert.equal(r.is_active,true)
  })
  await verified(cat('syncCatalogToEvent'),async()=>{
   // Create after the catalog mutations; explicit sync must be idempotent.
   await invoke(platformAction,head,cat('syncCatalogToEvent'),{event_id:e.id})
   await invoke(platformAction,head,cat('syncCatalogToEvent'),{event_id:e.id})
   const w=await one(a.from('workplaces').select('id,target_staff').eq('event_id',e.id).eq('catalog_workplace_id',post.id),'SYNC_POST')
   assert.equal(w.target_staff,3)
   const stock=await one(a.from('inventory_items').select('id').eq('event_id',e.id).eq('workplace_id',w.id).eq('catalog_item_id',item.id),'SYNC_ITEM')
   assert.ok(stock.id)
  })
 })
 await domain('checklist-template',async()=>{
  const t=crypto.randomUUID(),label=prefix+' Template checklist'
  assert.match(t,/^[0-9a-f-]{36}$/)
  assert.match(prefix,/^PHASE23-[0-9a-f]{12}$/)
  // Template editor is outside this action registry; seed only the dependency.
  sqlLocal("INSERT INTO public.operational_checklist_templates(id,title,kind,is_active) VALUES ('"+t+"','"+label+"','custom',true)")
  sqlLocal("INSERT INTO public.operational_checklist_template_items(template_id,label,required,requires_photo,sort_order) VALUES ('"+t+"','QA required',true,false,1),('"+t+"','QA photo',false,true,2)")
  await verified(crew('applyOperationalChecklistTemplate'),async()=>{
   const fields={template_id:t,event_id:event,workplace_id:workplace}
   await denied(inventory,staff,crew('applyOperationalChecklistTemplate'),fields)
   await invoke(inventory,head,crew('applyOperationalChecklistTemplate'),fields)
   const r=await one(a.from('operational_checklists').select('id,status').eq('event_id',event).eq('workplace_id',workplace).eq('title',label),'TEMPLATE_CHECKLIST')
   assert.equal(r.status,'open')
   const rows=await read(a.from('checklist_items').select('label,required,requires_photo').eq('checklist_id',r.id).order('sort_order'),'TEMPLATE_ITEMS')
   assert.deepEqual(rows,[{label:'QA required',required:true,requires_photo:false},{label:'QA photo',required:false,requires_photo:true}])
  })
 })
 await domain('planning-recommendations-and-report',async()=>{
  const e=await newEvent('Planning recommendations',24),post=await newPost(e,'Planning shortage',{target_staff:'2',maximum_staff:'4'})
  await available(e,alternate);await available(e,unrelated)
  let first,second
  await verified(platform('generatePlanningRecommendations'),async()=>{
   await denied(admin,staff,platform('generatePlanningRecommendations'),{event_id:e.id})
   await invoke(admin,head,platform('generatePlanningRecommendations'),{event_id:e.id})
   const rows=await read(a.from('planning_recommendations').select('id,recommended_user_id,status').eq('event_id',e.id).eq('workplace_id',post.id).eq('status','proposed'),'PLANNING')
   assert.equal(rows.length,2,'EXPECTED_TWO_CANDIDATES')
   assert.ok(rows.every(r=>[alternate.id,unrelated.id].includes(r.recommended_user_id)))
   // The recommendation query has no guaranteed row order. Membership admission
   // instead uses queue_joined_at and user ID (the DB's FIFO tie-breaker).
   const queue=await read(a.from('event_availability').select('user_id,queue_joined_at').eq('event_id',e.id).eq('response','can').order('queue_joined_at',{ascending:true}).order('user_id',{ascending:true}),'PLANNING_FIFO')
   assert.equal(queue.length,2)
   assert.ok(queue.every(r=>r.queue_joined_at))
   first=rows.find(r=>r.recommended_user_id===queue[0].user_id)
   second=rows.find(r=>r.recommended_user_id===queue[1].user_id)
   assert.ok(first&&second&&first.id!==second.id,'EXPECTED_FIFO_CANDIDATES')
  })
  await verified(platform('dismissPlanningRecommendation'),async()=>{
   // A lower-priority candidate must not bypass the waitlist even when both
   // recommendations exist. Denial must leave recommendation and member intact.
   await denied(admin,head,platform('applyPlanningRecommendation'),{recommendation_id:second.id})
   assert.equal((await find('planning_recommendations',second.id,'status')).status,'proposed')
   assert.equal((await read(a.from('event_members').select('user_id').eq('event_id',e.id).eq('user_id',second.recommended_user_id),'FIFO_DENIED_MEMBER')).length,0)
   await invoke(admin,head,platform('dismissPlanningRecommendation'),{recommendation_id:second.id})
   assert.equal((await find('planning_recommendations',second.id,'status')).status,'dismissed')
  })
  await verified(platform('applyPlanningRecommendation'),async()=>{
   await invoke(admin,head,platform('applyPlanningRecommendation'),{recommendation_id:first.id})
   const r=await find('planning_recommendations',first.id,'status,applied_shift_id')
   assert.equal(r.status,'applied');assert.ok(r.applied_shift_id)
   assert.equal((await find('shifts',r.applied_shift_id,'user_id')).user_id,first.recommended_user_id)
   await denied(admin,head,platform('applyPlanningRecommendation'),{recommendation_id:first.id})
  })
  await verified(platform('generateEventReport'),async()=>{
   await invoke(admin,head,platform('generateEventReport'),{event_id:e.id})
   const report=await one(a.from('event_report_snapshots').select('generated_by,generation_kind,snapshot').eq('event_id',e.id).eq('generation_kind','manual'),'EVENT_REPORT')
   assert.equal(report.generated_by,head.id);assert.ok(report.snapshot&&typeof report.snapshot==='object')
  })
 })
 await domain('crew-assignment-and-responsibility',async()=>{
  const e=await newEvent('Responsibility assignment',25),post=await newPost(e,'Responsibility post')
  const who=await c.actor('bot-11-staff-en',false,false)
  await available(e,who)
  const fields={event_id:e.id,workplace_id:post.id,user_id:who.id,role_name:'QA Crew',start:e.start_at,end:e.end_at}
  await verified(crew('assignAvailableCrewShift'),async()=>{
   await invoke(crewEvent,head,crew('assignAvailableCrewShift'),fields)
   const r=await one(a.from('shifts').select('id,scheduled_start,scheduled_end').eq('event_id',e.id).eq('workplace_id',post.id).eq('user_id',who.id),'ASSIGNED_SHIFT')
   assert.equal(Date.parse(r.scheduled_start),Date.parse(e.start_at));assert.equal(Date.parse(r.scheduled_end),Date.parse(e.end_at))
  })
  await verified(crew('assignResponsible'),async()=>{
   await denied(crewEvent,staff,crew('assignResponsible'),fields)
   await invoke(crewEvent,head,crew('assignResponsible'),fields)
   const r=await one(a.from('responsible_assignments').select('user_id').eq('workplace_id',post.id).eq('user_id',who.id),'RESPONSIBLE_ASSIGNMENT')
   assert.equal(r.user_id,who.id);assert.equal((await ownProfile(who)).role,'responsible_lead')
  })
  await verified(crew('demoteResponsibleToStaff'),async()=>{
   await invoke(crewEvent,head,crew('demoteResponsibleToStaff'),fields)
   assert.equal((await read(a.from('responsible_assignments').select('user_id').eq('workplace_id',post.id).eq('user_id',who.id),'RESPONSIBLE_REMOVAL')).length,0)
   assert.equal((await ownProfile(who)).role,'staff')
  })
 })
 await domain('event-task-management',async()=>{
  const e=await newEvent('Task event',26),post=await newPost(e,'Task post')
  await member(e,alternate);await member(e,unrelated);await member(e,promoter)
  let task,assignment
  const fields={event_id:e.id,workplace_id:post.id,user_id:alternate.id,title:prefix+' Event task',description:'QA task'}
  await verified(crew('createTask'),async()=>{
   await denied(finalCrew,staff,crew('createTask'),fields)
   await invoke(finalCrew,head,crew('createTask'),fields)
   task=await one(a.from('tasks').select('id,title,workplace_id').eq('event_id',e.id).eq('title',fields.title),'TASK')
   assert.equal(task.workplace_id,post.id)
   assignment=await one(a.from('task_assignments').select('id,user_id').eq('task_id',task.id).eq('user_id',alternate.id),'TASK_ASSIGN')
  })
  await verified(taskAction('editEventTask'),async()=>{
   await invoke(officeAction,head,taskAction('editEventTask'),{task_id:task.id,title:prefix+' Edited task',description:'Changed'})
   assert.equal((await find('tasks',task.id,'title')).title,prefix+' Edited task')
  })
  await verified(taskAction('updateAssignment'),async()=>{
   await invoke(officeAction,head,taskAction('updateAssignment'),{task_id:task.id,user_id:unrelated.id})
   assert.equal((await read(a.from('task_assignments').select('id').eq('task_id',task.id).eq('user_id',unrelated.id),'TASK_ASSIGN_OTHER')).length,1)
  })
  await verified(promotionAdmin('assignPromotionTask'),async()=>{
   await invoke(officeAction,head,promotionAdmin('assignPromotionTask'),{task_id:task.id,user_id:promoter.id})
   assert.equal((await read(a.from('task_assignments').select('id').eq('task_id',task.id).eq('user_id',promoter.id),'PROMO_ASSIGN')).length,1)
  })
  await verified(promotionAdmin('removePromotionAssignment'),async()=>{
   const r=await one(a.from('task_assignments').select('id').eq('task_id',task.id).eq('user_id',promoter.id),'PROMO_REMOVE_FIXTURE')
   await invoke(officeAction,head,promotionAdmin('removePromotionAssignment'),{assignment_id:r.id})
   assert.equal((await read(a.from('task_assignments').select('id').eq('id',r.id),'PROMO_REMOVE')).length,0)
  })
  await verified(crew('removeTaskAssignment'),async()=>{
   await invoke(operations,head,crew('removeTaskAssignment'),{assignment_id:assignment.id})
   assert.equal((await read(a.from('task_assignments').select('id').eq('id',assignment.id),'TASK_REMOVE')).length,0)
  })
 })
 await domain('document-file-uploads',async()=>{
  const text='Synthetic document QA bytes'
  const file=()=>new File([text],'qa-document.txt',{type:'text/plain'})
  const verify=async(title)=>{
   const doc=await one(a.from('event_documents').select('storage_path,file_size_bytes,mime_type,offline_critical').eq('event_id',event).eq('title',title),'FILE_DOCUMENT')
   assert.equal(doc.file_size_bytes,new TextEncoder().encode(text).byteLength);assert.equal(doc.mime_type,'text/plain');assert.equal(doc.offline_critical,true)
   assert.match(doc.storage_path,/^[0-9a-f-]{36}\/document\/[0-9a-f-]{36}\.txt$/i)
   assert.equal(sqlLocal("SELECT status FROM public.upload_security_scans WHERE bucket_id='work-media' AND storage_path='"+doc.storage_path+"'"),'pending')
   assert.ok((await a.storage.from('work-media').download(doc.storage_path)).error)
  }
  await verified(crew('createEventDocument'),async()=>{
   const title=prefix+' File document',fields={event_id:event,workplace_id:workplace,title,kind:'technical',audience:'employee',offline_critical:'on'}
   await invoke(finalCrew,head,crew('createEventDocument'),{...fields,document:file()})
   await verify(title)
  })
  await verified(crew('createPriceListDocument'),async()=>{
   const name=prefix+' File price list'
   await invoke(finalCrew,head,crew('createPriceListDocument'),{event_id:event,workplace_id:workplace,workplace_name:name,document:file()})
   await verify('Prijslijst · '+name)
  })
 })
 await domain('administration-counterparties',async()=>{
  const fields={name:prefix+' Directory supplier',kind:'supplier',email:'qa@example.invalid',country_code:'BE',city:'QA City'}
  let supplier
  await verified(counter('addCounterparty'),async()=>{
   await denied(details,staff,counter('addCounterparty'),fields)
   await invoke(details,office,counter('addCounterparty'),fields)
   supplier=await one(a.from('admin_counterparties').select('id,kind,email,country_code').eq('name',fields.name),'DIRECTORY_ADD')
   assert.equal(supplier.kind,'supplier');assert.equal(supplier.email,fields.email);assert.equal(supplier.country_code,'BE')
  })
  await verified(counter('updateCounterparty'),async()=>{
   await invoke(details,office,counter('updateCounterparty'),{...fields,id:supplier.id,city:'Changed City',kind:'both'})
   const r=await find('admin_counterparties',supplier.id,'city,kind')
   assert.equal(r.city,'Changed City');assert.equal(r.kind,'both')
  })
 })
 await domain('administration-artist-agreements',async()=>{
  const name=prefix+' Agency',email='qa-agency@example.invalid'
  await invoke(details,office,counter('addCounterparty'),{name,kind:'supplier',email})
  const agency=await one(a.from('admin_counterparties').select('id').eq('name',name),'AGENCY')
  const e=await newEvent('Artist event',27),artist=prefix+' Artist booking'
  let b,v,r
  await verified(newBooking,async()=>{
   await invoke(details,office,newBooking,{event_id:e.id,artist_name:artist,agency_contact_id:agency.id,fee_amount:'500',performance_at:e.start_at,rider_notes:'QA rider'})
   b=await one(a.from('admin_artist_bookings').select('id,status,agency_contact_id,fee_amount,created_by').eq('artist_name',artist),'ARTIST_CREATE')
   assert.equal(b.status,'enquiry');assert.equal(b.agency_contact_id,agency.id);assert.equal(Number(b.fee_amount),500);assert.equal(b.created_by,office.id)
  })
  await verified(booking('updateBooking'),async()=>{
   await invoke(details,office,booking('updateBooking'),{id:b.id,status:'negotiating',rider_notes:'Updated QA rider',internal_notes:'QA notes'})
   const row=await find('admin_artist_bookings',b.id,'status,rider_notes')
   assert.equal(row.status,'negotiating');assert.equal(row.rider_notes,'Updated QA rider')
  })
  await verified(booking('recordCommunication'),async()=>{
   const msg='QA recorded reply, no message dispatched'
   await invoke(details,office,booking('recordCommunication'),{id:b.id,kind:'reply_received',details:msg})
   const row=await one(a.from('admin_artist_booking_communications').select('actor_id,kind,details').eq('booking_id',b.id),'BOOKING_COMMUNICATION')
   assert.equal(row.actor_id,office.id);assert.equal(row.kind,'reply_received');assert.equal(row.details,msg)
  })
  await verified(agreement('saveTerms'),async()=>{
   const terms={agreement_payment_terms:'QA payment',agreement_cancellation_terms:'QA cancellation',agreement_liability_terms:'QA liability',agreement_governing_law:'Belgium'}
   await invoke(agreements,office,agreement('saveTerms'),{id:b.id,...terms})
   assert.deepEqual(await find('admin_artist_bookings',b.id,Object.keys(terms).join(',')),terms)
  })
  await verified(agreement('snapshotAgreement'),async()=>{
   await invoke(agreements,office,agreement('snapshotAgreement'),{id:b.id})
   v=await one(a.from('admin_artist_agreement_versions').select('id,version_number,created_by,snapshot,approved_at').eq('booking_id',b.id),'AGREEMENT_SNAPSHOT')
   assert.equal(v.version_number,1);assert.equal(v.created_by,office.id);assert.equal(v.snapshot.agency_email,email);assert.equal(v.approved_at,null)
  })
  await verified(agreement('approveAgreement'),async()=>{
   const fields={id:b.id,version_id:v.id}
   await denied(agreements,office,agreement('approveAgreement'),fields)
   await invoke(agreements,head,agreement('approveAgreement'),fields)
   const row=await find('admin_artist_agreement_versions',v.id,'approved_by,approved_at')
   assert.equal(row.approved_by,head.id);assert.ok(row.approved_at)
  })
  await verified(agreement('prepareSignature'),async()=>{
   const fields={id:b.id,version_id:v.id,recipient_email:email}
   await denied(agreements,office,agreement('prepareSignature'),{...fields,recipient_email:'wrong@example.invalid'})
   await invoke(agreements,office,agreement('prepareSignature'),fields)
   r=await one(a.from('admin_artist_agreement_signature_requests').select('id,status,recipient_email').eq('agreement_version_id',v.id),'SIGNATURE_PREPARATION')
   assert.equal(r.status,'prepared');assert.equal(r.recipient_email,email)
  })
  // Signed ledger plus synthetic Documenso transport. Deliberately do NOT
  // register refreshSigning as a live/positive persistence action.
  await domain('documenso-read-only-provider-contract',async()=>{
   assert.equal(process.env.BOT_SUPABASE_URL,'http://127.0.0.1:54321')
   assert.match(v.id,/^[0-9a-f-]{36}$/i)
   const envelope='phase23-'+v.id
   const digest='a'.repeat(64)
   sqlLocal("INSERT INTO public.administration_contract_signing_requests(document_type,document_id,document_version,document_sha256,envelope_id,recipient_email) VALUES ('artist','"+v.id+"',1,'"+digest+"','"+envelope+"','qa-agency@example.invalid')")
   const hash=()=>sqlLocal("SELECT md5(to_jsonb(r)::text) FROM public.administration_contract_signing_requests r WHERE document_id='"+v.id+"'::uuid AND document_type='artist'")
   const baseline=hash()
   assert.match(baseline,/^[a-f0-9]{32}$/)
   const id=agreement('refreshSigning'),fields={booking_id:b.id,version_id:v.id,version:'1'}
   const realFetch=globalThis.fetch
   let calls=0,mode='valid'
   const config={DOCUMENSO_BASE_URL:'https://app.documenso.com',DOCUMENSO_API_KEY:'synthetic-local-provider-fixture'}
   const handler=(request,db,selected)=>agreements(request,db,selected,config)
   try{
    globalThis.fetch=async(input,init)=>{
     const request=new Request(input,init),url=new URL(request.url)
     if(url.origin==='http://127.0.0.1:54321')return realFetch(input,init)
     assert.equal(url.href,'https://app.documenso.com/api/v2/envelope/'+envelope)
     assert.equal(request.method,'GET')
     assert.equal(request.headers.get('authorization'),config.DOCUMENSO_API_KEY)
     calls++
     if(mode==='oversized')return new Response('x'.repeat(65537),{headers:{'content-type':'application/json'}})
     if(mode==='non-json')return new Response('{}',{headers:{'content-type':'text/plain'}})
     return Response.json({id:mode==='mismatch'?'wrong-envelope':envelope,status:'COMPLETED'})
    }
    await denied(agreements,office,id,fields)
    await denied(handler,staff,id,fields)
    await denied(handler,office,id,{...fields,version:'2'})
    assert.equal(calls,0,'PROVIDER_CALL_BEFORE_AUTHORIZATION')
    const result=await invoke(handler,office,id,fields)
    assert.equal(result.data.redirect,'/portals/administration/modules/artists/'+b.id+'/agreement','DOCUMENSO_REFRESH_REDIRECT')
    assert.equal(calls,1)
    for(const invalid of ['mismatch','oversized','non-json']){
     mode=invalid
     await denied(handler,office,id,fields)
    }
    assert.equal(calls,4)
    assert.equal(hash(),baseline,'READ_ONLY_REFRESH_MUTATED_LEDGER')
    console.log('PASS local Documenso contract: signed authorization, exact envelope, bounded response, unchanged ledger; synthetic provider only')
   }finally{
    globalThis.fetch=realFetch
    sqlLocal("DELETE FROM public.administration_contract_signing_requests WHERE document_id='"+v.id+"'::uuid AND document_type='artist' AND envelope_id='"+envelope+"'")
    assert.equal(hash(),'')
   }
  })
  await verified(agreement('cancelSignaturePreparation'),async()=>{
   await invoke(agreements,office,agreement('cancelSignaturePreparation'),{id:b.id,request_id:r.id})
   const row=await find('admin_artist_agreement_signature_requests',r.id,'status,cancelled_at')
   assert.equal(row.status,'cancelled');assert.ok(row.cancelled_at)
  })
 })
 await domain('administration-event-draft-and-inbox',async()=>{
  let draft
  await verified(module('saveAdministrationEventDraft'),async()=>{
   const fields={name:prefix+' Office draft',...dateRange(28),venue:'QA venue'}
   await denied(officeAction,staff,module('saveAdministrationEventDraft'),fields)
   await invoke(officeAction,office,module('saveAdministrationEventDraft'),fields)
   draft=await one(a.from('events').select('id,status,created_by,venue').eq('name',fields.name),'OFFICE_DRAFT')
   assert.equal(draft.status,'draft');assert.equal(draft.created_by,office.id);assert.equal(draft.venue,fields.venue)
   await invoke(officeAction,office,module('saveAdministrationEventDraft'),{...fields,event_id:draft.id,venue:'Edited venue'})
   assert.equal((await find('events',draft.id,'venue')).venue,'Edited venue')
  })
  assert.match(office.id,/^[0-9a-f-]{36}$/i);assert.match(unrelated.id,/^[0-9a-f-]{36}$/i)
  const title=prefix+' Office inbox'
  sqlLocal("INSERT INTO public.crew_notifications(user_id,title,kind) SELECT '"+office.id+"','"+title+"','inventory' FROM generate_series(1,52)")
  const foreign=sqlLocal("INSERT INTO public.crew_notifications(user_id,title,kind) VALUES ('"+unrelated.id+"','"+title+"','inventory') RETURNING id").split('\n')[0]
  const own=await read(office.db.from('crew_notifications').select('id,read_at').eq('title',title),'OFFICE_NOTIFICATIONS')
  await verified(module('markAdministrationNotificationRead'),async()=>{
   assert.equal(own.length,52)
   await invoke(officeAction,office,module('markAdministrationNotificationRead'),{notification_id:own[0].id})
   assert.ok((await one(office.db.from('crew_notifications').select('read_at').eq('id',own[0].id),'OFFICE_READ')).read_at)
  })
  await verified(module('markAllAdministrationNotificationsRead'),async()=>{
   await invoke(officeAction,office,module('markAllAdministrationNotificationsRead'),{},{noForm:true})
   const rows=await read(office.db.from('crew_notifications').select('read_at').eq('title',title),'OFFICE_READ_ALL')
   assert.equal(rows.length,52);assert.ok(rows.every(r=>r.read_at))
   assert.equal((await one(unrelated.db.from('crew_notifications').select('read_at').eq('id',foreign),'FOREIGN_OFFICE_NOTIFICATION')).read_at,null)
  })
 })
 await domain('administration-work-queue',async()=>{
  const id=component('operational-work-queue','saveCase'),title=prefix+' Logistics case'
  const fields={kind:'logistics',title,details:'Synthetic logistics',deadline:new Date(Date.now()+86400000).toISOString().slice(0,10)}
  await verified(id,async()=>{
   await denied(details,staff,id,fields)
   await invoke(details,office,id,fields)
   let row=await one(a.from('admin_operational_obligations').select('id,status,created_by,updated_at').eq('title',title),'CASE_CREATE')
   assert.equal(row.status,'open');assert.equal(row.created_by,office.id)
   const transition=(action,actor)=>invoke(details,actor,id,{id:row.id,kind:'logistics',status:row.status,updated_at:row.updated_at,action})
   await transition('submitted',office)
   row=await find('admin_operational_obligations',row.id,'id,status,updated_at')
   assert.equal(row.status,'submitted')
   await denied(details,office,id,{id:row.id,kind:'logistics',status:row.status,updated_at:row.updated_at,action:'approved'})
   await transition('approved',head)
   row=await find('admin_operational_obligations',row.id,'id,status,updated_at,approved_by')
   assert.equal(row.status,'approved');assert.equal(row.approved_by,head.id)
  })
 })
 await domain('peppol-draft-fields',async()=>{
  const number=prefix+' Peppol draft'
  await saved('createDraft',office,{kind:'sales_invoice',document_number:number,net_amount:'100',tax_amount:'21'})
  const doc=await one(a.from('admin_financial_documents').select('id,status').eq('document_number',number),'PEPPOL_DRAFT')
  await saved('addInvoiceLine',office,{document_id:doc.id,description:'QA Peppol line',quantity:'1',unit_price:'100',vat_rate:'21'})
  const line=await one(a.from('admin_financial_lines').select('id').eq('document_id',doc.id),'PEPPOL_LINE')
  await verified(component('peppol-document-fields','saveReferences'),async()=>{
   const fields={document_id:doc.id,buyer_reference:prefix,order_reference:'QA order',delivery_date:'2026-11-26',delivery_country:'BE'}
   await invoke(details,office,component('peppol-document-fields','saveReferences'),fields)
   const r=await find('admin_financial_documents',doc.id,'buyer_reference,order_reference,delivery_date,delivery_country')
   assert.equal(r.buyer_reference,prefix);assert.equal(r.order_reference,'QA order');assert.equal(r.delivery_date,'2026-11-26');assert.equal(r.delivery_country,'BE')
  })
  await verified(component('peppol-document-fields','saveLine'),async()=>{
   await invoke(details,office,component('peppol-document-fields','saveLine'),{document_id:doc.id,line_id:line.id,unit_code:'HUR',vat_category:'S'})
   const r=await find('admin_financial_lines',line.id,'unit_code,vat_category')
   assert.equal(r.unit_code,'HUR');assert.equal(r.vat_category,'S')
  })
 })
 await runFinalDomains({...c,newEvent,newPost,available,member,dateRange})
}
