// Remaining positive acceptance tests. All writes use signed original-action
// handlers; local SQL is reserved for fixture prerequisites and private evidence.
import assert from 'node:assert/strict'
import {nativeAdminActionResponse as admin} from '../src/api/native-admin-actions.ts'
import {nativeWaveTwoActionResponse as platformAction} from '../src/api/native-platform-actions.ts'
import {nativeWaveThreeActionResponse as shiftAction} from '../src/api/native-event-shift-actions.ts'
import {nativeRosterActionResponse as roster} from '../src/api/native-roster-handover-actions.ts'
import {nativeInventoryActionResponse as inventory} from '../src/api/native-inventory-checklist-actions.ts'
import {megaCrewEventResponse as crewEvent} from '../src/api/native-mega-crew-event-actions.ts'
import {megaPeopleResponse as people} from '../src/api/native-mega-people-actions.ts'
import {nativeWaveNineResponse as safeAction} from '../src/api/native-wave-nine-safe-actions.ts'
import {finalCrewActionResponse as finalCrew} from '../src/api/native-final-crew-actions.ts'
import {finalAdminDetailsResponse as details} from '../src/api/native-final-admin-details.ts'
import {finalOperationsActionResponse as ops} from '../src/api/native-final-operations-actions.ts'
import {finalFinanceResponse as financeAction} from '../src/api/native-final-finance-actions.ts'

export async function runFinalDomains(c){
 const {head,maker,staff,office,promoter,unrelated,alternate,event,workplace,prefix,a,read,one,find,sqlLocal,invoke,denied,verified,domain,crew,platform,finance,saved,newEvent,newPost,available,member}=c
 const ap='app/(app)/portals/administration/'
 const component=(f,n)=>'components/administration/'+f+'.tsx#'+n
 const discipline=n=>ap+'promotion-discipline/page.tsx#'+n
 const promo=n=>'app/(app)/portals/promotion/tasks/page.tsx#'+n
 const rosters=n=>ap+'rosters/page.tsx#'+n
 const sales=n=>'lib/actions/sales.ts#'+n
 const person=n=>'lib/actions/personnel.ts#'+n
 const quoteId=id=>{assert.match(id,/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i);return "'"+id+"'::uuid"}
 const privateState=(table,id,col='status')=>{
  assert.ok(['shift_change_requests','shift_handovers'].includes(table))
  assert.ok(['status','replacement_response'].includes(col))
  return sqlLocal('SELECT '+col+' FROM upt_private.'+table+' WHERE id='+quoteId(id))
 }
 const createShift=async(e,post,who,label,start=e.start_at,end=e.end_at)=>{
  const name=prefix+' '+label
  await invoke(roster,head,crew('createShift'),{workplace_id:post.id,user_id:who.id,role_name:name,start,end})
  return one(a.from('shifts').select('id,user_id,scheduled_start,scheduled_end').eq('event_id',e.id).eq('role_name',name),'FINAL_SHIFT')
 }
 const issueItem=async(post,name,quantity=8)=>{
  const label=prefix+' '+name
  await invoke(inventory,head,crew('createInventoryItem'),{workplace_id:post.id,name:label,quantity:String(quantity),item_kind:'consumable'})
  return one(a.from('inventory_items').select('id,total_quantity,available_quantity').eq('workplace_id',post.id).eq('name',label),'FINAL_ITEM')
 }
 await domain('onboarding-own-progress',async()=>{
  const e=await newEvent('Onboarding progress',32)
  await member(e,alternate)
  const id='lib/actions/onboarding.ts#completeEventOnboardingStep',fields={event_id:e.id,step:'safety'}
  await verified(id,async()=>{
   await denied(platformAction,unrelated,id,fields)
   await invoke(platformAction,alternate,id,fields)
   await invoke(platformAction,alternate,id,fields)
   const row=await one(a.from('event_onboarding_progress').select('user_id,step,completed_at').eq('event_id',e.id).eq('user_id',alternate.id).eq('step','safety'),'ONBOARDING_PROGRESS')
   assert.equal(row.user_id,alternate.id);assert.ok(row.completed_at)
  })
 })
 await domain('platform-rollout-snapshot-restore',async()=>{
  const key='qa-'+prefix.toLowerCase(),fields={feature_key:key,enabled:'on',audience:'all',rollout_percentage:'65',notes:'Synthetic QA rollout'}
  const fetchRollout=()=>one(a.from('feature_rollouts').select('enabled,audience,rollout_percentage,notes').eq('feature_key',key),'ROLLOUT')
  let version
  await verified(platform('setFeatureRollout'),async()=>{
   await denied(platformAction,staff,platform('setFeatureRollout'),fields)
   await invoke(platformAction,head,platform('setFeatureRollout'),fields)
   assert.deepEqual(await fetchRollout(),{enabled:true,audience:'all',rollout_percentage:65,notes:fields.notes})
  })
  await verified(platform('snapshotPlatformConfiguration'),async()=>{
   await invoke(platformAction,head,platform('snapshotPlatformConfiguration'),{note:prefix+' QA snapshot'})
   version=await one(a.from('configuration_versions').select('id,snapshot,created_by').eq('note',prefix+' QA snapshot'),'PLATFORM_SNAPSHOT')
   assert.equal(version.created_by,head.id);assert.ok(version.snapshot.featureRollouts.some(x=>x.feature_key===key&&x.rollout_percentage===65))
  })
  await verified(platform('restorePlatformConfiguration'),async()=>{
   await invoke(platformAction,head,platform('setFeatureRollout'),{...fields,enabled:'off',rollout_percentage:'10'})
   assert.equal((await fetchRollout()).rollout_percentage,10)
   await denied(platformAction,staff,platform('restorePlatformConfiguration'),{version_id:version.id})
   await invoke(platformAction,head,platform('restorePlatformConfiguration'),{version_id:version.id})
   assert.equal((await fetchRollout()).rollout_percentage,65);assert.equal((await fetchRollout()).enabled,true)
  })
 })
 await domain('maker-automation-rule',async()=>{
  const key=sqlLocal('SELECT automation_key FROM public.automation_rules ORDER BY automation_key LIMIT 1')
  assert.match(key,/^[a-z0-9_-]{1,120}$/)
  const fields={automation_key:key,enabled:'on',delay_minutes:'3',reminder_minutes:'5',escalation_minutes:'10',cooldown_minutes:'15',max_retries:'2',channel:['in_app']}
  await verified(platform('saveAutomationRule'),async()=>{
   await denied(platformAction,head,platform('saveAutomationRule'),fields)
   await invoke(platformAction,maker,platform('saveAutomationRule'),fields)
   const row=JSON.parse(sqlLocal("SELECT to_jsonb(r) FROM public.automation_rules r WHERE automation_key='"+key+"'"))
   assert.equal(row.updated_by,maker.id);assert.equal(row.delay_minutes,3);assert.equal(row.reminder_minutes,5);assert.equal(row.escalation_minutes,10)
   assert.equal(row.cooldown_minutes,15);assert.equal(row.max_retries,2);assert.deepEqual(row.channels,['in_app'])
  })
 })
 await domain('personnel-dual-role-slots',async()=>{
  const who=await c.actor('bot-11-staff-en',false,false)
  const id='lib/actions/personnel-dual-roles.ts#savePersonnelRoleSlot'
  await verified(id,async()=>{
   const fields={user_id:who.id,role_one:'staff',role_two:'promotion',save_slot:'2'}
   const result=await invoke(people,head,id,fields,{state:true})
   assert.ok(result.data.redirect?.includes('feedback=roles_saved'))
   const row=await one(a.from('upt_personnel_role_slots').select('role_one,role_two').eq('user_id',who.id),'DUAL_ROLE')
   assert.deepEqual(row,{role_one:'staff',role_two:'promotion'})
   const conflict=await invoke(people,head,id,{...fields,role_two:'responsible_lead'},{state:true})
   assert.ok(!conflict.data.redirect?.includes('feedback=roles_saved'))
   assert.deepEqual(await one(a.from('upt_personnel_role_slots').select('role_one,role_two').eq('user_id',who.id),'DUAL_ROLE_UNCHANGED'),row)
  })
 })
 await domain('refund-sale',async()=>{
  const e=await newEvent('Refund sale',33),post=await newPost(e,'Refund counter')
  const item=await issueItem(post,'Refund stock')
  await invoke(admin,head,sales('configureSaleItem'),{item_id:item.id,enabled:'on',sale_category:'merch',price:'5.00'})
  const id=await read(a.rpc('upt_sales_record',{p_item:item.id,p_quantity:2,p_payment_method:'cash'}),'SALE_FIXTURE')
  await verified(sales('refundSale'),async()=>{
   const fields={sale_id:id,quantity:'1',notes:'QA partial refund'}
   await denied(admin,staff,sales('refundSale'),fields)
   await invoke(admin,head,sales('refundSale'),fields)
   const refund=await one(a.from('sales_transactions').select('quantity,unit_price_cents,transaction_type').eq('original_sale_id',id),'REFUND')
   assert.equal(refund.quantity,1);assert.equal(refund.unit_price_cents,500);assert.equal(refund.transaction_type,'refund')
   assert.equal((await find('inventory_items',item.id,'available_quantity')).available_quantity,7)
   await denied(admin,head,sales('refundSale'),{...fields,quantity:'2'})
   assert.equal((await read(a.from('sales_transactions').select('id').eq('original_sale_id',id),'REFUND_REJECTED')).length,1)
  })
 })
 await domain('shift-reassignment-and-changes',async()=>{
  const e=await newEvent('Shift requests',34),post=await newPost(e,'Shift requests post')
  // Join in FIFO order before assigning shifts; no recommendation-order assumption.
  await member(e,alternate);await member(e,unrelated);await member(e,staff)
  const source=await createShift(e,post,alternate,'Replacement shift')
  const shiftId=source.id,reason='Synthetic QA schedule change'
  const request=async(type,id=shiftId)=>sqlLocal("SELECT id FROM upt_private.shift_change_requests WHERE shift_id="+quoteId(id)+" AND type='"+type+"' ORDER BY created_at DESC LIMIT 1")
  let replacement,swap,claim
  await verified(crew('requestShiftReplacement'),async()=>{
   const fields={shift_id:shiftId,replacement_user_id:unrelated.id,reason}
   await denied(shiftAction,staff,crew('requestShiftReplacement'),fields)
   await invoke(shiftAction,alternate,crew('requestShiftReplacement'),fields)
   replacement=await request('replacement');assert.equal(privateState('shift_change_requests',replacement),'pending')
  })
  await verified(crew('respondShiftChange'),async()=>{
   const fields={request_id:replacement,response:'accepted'}
   await denied(shiftAction,staff,crew('respondShiftChange'),fields)
   await invoke(shiftAction,unrelated,crew('respondShiftChange'),fields)
   assert.equal(privateState('shift_change_requests',replacement,'replacement_response'),'accepted')
  })
  await verified(crew('decideShiftChange'),async()=>{
   const fields={request_id:replacement,decision:'approved',reason}
   await denied(shiftAction,staff,crew('decideShiftChange'),fields)
   await invoke(shiftAction,head,crew('decideShiftChange'),fields)
   assert.equal(privateState('shift_change_requests',replacement),'approved')
   assert.equal((await find('shifts',shiftId,'user_id')).user_id,unrelated.id)
  })
  await verified(crew('reassignShift'),async()=>{
   await invoke(shiftAction,head,crew('reassignShift'),{shift_id:shiftId,user_id:alternate.id,reason})
   assert.equal((await find('shifts',shiftId,'user_id')).user_id,alternate.id)
  })
  const target=await createShift(e,post,unrelated,'Swap shift')
  await verified(crew('requestShiftSwap'),async()=>{
   await invoke(shiftAction,alternate,crew('requestShiftSwap'),{shift_id:shiftId,replacement_user_id:unrelated.id,target_shift_id:target.id,reason})
   swap=await request('swap');assert.equal(privateState('shift_change_requests',swap),'pending')
   assert.equal(sqlLocal('SELECT target_shift_id FROM upt_private.shift_change_requests WHERE id='+quoteId(swap)),target.id)
  })
  await verified(crew('cancelShiftChange'),async()=>{
   const fields={request_id:swap}
   await denied(shiftAction,unrelated,crew('cancelShiftChange'),fields)
   await invoke(shiftAction,alternate,crew('cancelShiftChange'),fields)
   assert.equal(privateState('shift_change_requests',swap),'cancelled')
  })
  await verified(crew('claimOpenShift'),async()=>{
   await invoke(roster,alternate,crew('declineShift'),{shift_id:shiftId,reason})
   await invoke(shiftAction,staff,crew('claimOpenShift'),{shift_id:shiftId,reason})
   claim=await request('claim-open-shift');assert.equal(privateState('shift_change_requests',claim),'pending')
   assert.equal(privateState('shift_change_requests',claim,'replacement_response'),'accepted')
   await invoke(shiftAction,head,crew('decideShiftChange'),{request_id:claim,decision:'approved',reason})
   assert.equal((await find('shifts',shiftId,'user_id')).user_id,staff.id)
  })
 })
 await domain('responsible-handover',async()=>{
  // Separate current event. Establish the legitimate responsible assignments
  // through the same signed crew actions before moving fixture time to now.
  const e=await newEvent('Handover',35),post=await newPost(e,'Handover post')
  await member(e,alternate);await member(e,unrelated)
  await createShift(e,post,alternate,'Handover outgoing')
  await createShift(e,post,unrelated,'Handover incoming')
  for(const who of [alternate,unrelated])await invoke(crewEvent,head,crew('assignResponsible'),{workplace_id:post.id,user_id:who.id})
  sqlLocal("UPDATE public.events SET start_at=now()-interval '15 minutes',start_date=now()-interval '15 minutes',end_at=now()+interval '3 hours',end_date=now()+interval '3 hours',registration_deadline=now()-interval '15 minutes' WHERE id="+quoteId(e.id))
  let id
  await verified(crew('saveShiftHandover'),async()=>{
   const fields={event_id:e.id,workplace_id:post.id,incoming_user_id:unrelated.id,mark_ready:'true',notes:'Synthetic QA handover',equipment_notes:'QA radios'}
   await denied(roster,staff,crew('saveShiftHandover'),fields)
   await invoke(roster,alternate,crew('saveShiftHandover'),fields)
   id=sqlLocal('SELECT id FROM upt_private.shift_handovers WHERE event_id='+quoteId(e.id)+' AND workplace_id='+quoteId(post.id))
   assert.equal(privateState('shift_handovers',id),'ready')
   assert.equal(sqlLocal('SELECT incoming_responsible_id FROM upt_private.shift_handovers WHERE id='+quoteId(id)),unrelated.id)
  })
  await verified(crew('acceptShiftHandover'),async()=>{
   await denied(roster,staff,crew('acceptShiftHandover'),{handover_id:id})
   await invoke(roster,unrelated,crew('acceptShiftHandover'),{handover_id:id})
   assert.equal(privateState('shift_handovers',id),'accepted')
   await denied(roster,unrelated,crew('acceptShiftHandover'),{handover_id:id})
  })
  for(const who of [alternate,unrelated])await invoke(crewEvent,head,crew('demoteResponsibleToStaff'),{workplace_id:post.id,user_id:who.id})
 })
 await domain('driver-transport-task',async()=>{
  const e=await newEvent('Driver task',36)
  // The driver action requires a workplace whose name contains Driver.
  const post=await newPost(e,'Driver QA')
  await member(e,alternate)
  const shift=await createShift(e,post,alternate,'Driver shift')
  const fields={shift_id:shift.id,direction:'pickup',passenger_name:prefix+' Passenger',passenger_phone:'000000000',address:'Synthetic QA location',scheduled_at:e.start_at,manual_travel_minutes:'25',manual_route_km:'12.5'}
  await verified(crew('createDriverTransportTask'),async()=>{
   await denied(finalCrew,staff,crew('createDriverTransportTask'),fields)
   await invoke(finalCrew,head,crew('createDriverTransportTask'),fields)
   const task=await one(a.from('tasks').select('id,workplace_id').eq('event_id',e.id).eq('title','Ophalen · '+fields.passenger_name),'DRIVER_TASK')
   const row=await one(a.from('driver_task_details').select('direction,passenger_name,estimated_drive_minutes,expected_km,scheduled_at,notify_at').eq('task_id',task.id),'DRIVER_DETAILS')
   assert.equal(row.direction,'pickup');assert.equal(row.passenger_name,fields.passenger_name);assert.equal(row.estimated_drive_minutes,25);assert.equal(Number(row.expected_km),12.5)
   assert.equal(Date.parse(row.scheduled_at)-Date.parse(row.notify_at),40*60000)
  })
 })
 await domain('promotion-evidence-lifecycle',async()=>{
  const title=prefix+' Promotion proof task',request=crypto.randomUUID()
  const created=await invoke(people,head,'lib/actions/promotion-tasks.ts#createPromotionTask',{request,title,description:'Synthetic proof',user_id:promoter.id,admin_view:'1'})
  assert.ok(created.data.redirect?.includes('saved=1'))
  const task=await find('tasks',request,'id,promotion_only,event_id')
  assert.equal(task.promotion_only,true);assert.equal(task.event_id,null)
  const assignment=await one(a.from('task_assignments').select('id').eq('task_id',task.id).eq('user_id',promoter.id),'PROMO_PROOF_ASSIGNMENT')
  // Tiny genuine PNG; no external image, no live upload. Different hashes
  // for reference and evidence are obtained by distinct valid PNG payloads.
  const image=(reference=false)=>new File([Uint8Array.from(Buffer.from(reference?'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN1sAAAAASUVORK5CYII=':'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=','base64'))],'qa.png',{type:'image/png'})
  await verified(discipline('unblock'),async()=>{
   sqlLocal("INSERT INTO public.promotion_discipline(user_id,strikes,suspension_count,permanently_blocked) VALUES ("+quoteId(promoter.id)+",2,2,true) ON CONFLICT(user_id) DO UPDATE SET permanently_blocked=true,strikes=2,suspension_count=2")
   const fields={user:promoter.id,reason:'Synthetic QA unblock with audit'}
   await denied(ops,staff,discipline('unblock'),fields)
   await invoke(ops,head,discipline('unblock'),fields)
   assert.equal(sqlLocal('SELECT permanently_blocked FROM public.promotion_discipline WHERE user_id='+quoteId(promoter.id)),'f')
  })
  await verified(discipline('registerReference'),async()=>{
   await invoke(ops,head,discipline('registerReference'),{task_id:task.id,reference:image(true)})
   const row=await one(a.from('promotion_reference_media').select('storage_path,sha256,created_by').eq('task_id',task.id),'PROMO_REFERENCE')
   assert.equal(row.created_by,head.id);assert.match(row.sha256,/^[a-f0-9]{64}$/)
   assert.match(row.storage_path,/^[0-9a-f-]{36}\/promotion-reference\/[0-9a-f-]{36}\.png$/i)
  })
  await verified(promo('changePromotionTaskStatus'),async()=>{
   await denied(ops,staff,promo('changePromotionTaskStatus'),{assignment_id:assignment.id,status:'IN PROGRESS'})
   await invoke(ops,promoter,promo('changePromotionTaskStatus'),{assignment_id:assignment.id,status:'IN PROGRESS'})
   const row=await find('task_assignments',assignment.id,'status,confirmed_at')
   assert.equal(row.status,'IN PROGRESS');assert.ok(row.confirmed_at)
  })
  let evidence
  await verified(promo('submitPromotionEvidence'),async()=>{
   await invoke(ops,promoter,promo('submitPromotionEvidence'),{assignment_id:assignment.id,evidence:image()})
   evidence=await one(a.from('promotion_evidence').select('id,submitted_by,evidence_sha256,storage_path').eq('assignment_id',assignment.id),'PROMO_EVIDENCE')
   assert.equal(evidence.submitted_by,promoter.id);assert.match(evidence.evidence_sha256,/^[a-f0-9]{64}$/)
  })
  await verified(discipline('reviewEvidence'),async()=>{
   const fields={evidence_id:evidence.id,status:'verified',reason:'QA evidence reviewed by administrator'}
   await denied(ops,staff,discipline('reviewEvidence'),fields)
   await invoke(ops,head,discipline('reviewEvidence'),fields)
   assert.equal((await find('promotion_evidence',evidence.id,'verification_status')).verification_status,'verified')
   assert.equal((await find('task_assignments',assignment.id,'status')).status,'COMPLETED')
  })
 })
 await domain('administrative-roster-proposal',async()=>{
  // Use exact Brussels wall-clock values, not UTC strings masquerading as local.
  const e=await newEvent('Roster proposal',38),post=await newPost(e,'Roster proposal post')
  await member(e,alternate);await member(e,unrelated)
  const local=iso=>{const parts=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Brussels',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(iso));return parts.replace(' ','T')}
  const start=new Date(Math.ceil((Date.parse(e.start_at)+60000)/60000)*60000).toISOString(),end=new Date(Math.floor((Date.parse(e.end_at)-60000)/60000)*60000).toISOString()
  const title=prefix+' Roster plan',fields={event:e.id,title,details:'QA roster',start:local(start),end:local(end)}
  let proposal
  await verified(rosters('createProposal'),async()=>{
   await denied(ops,staff,rosters('createProposal'),fields)
   await invoke(ops,office,rosters('createProposal'),fields)
   proposal=await one(a.from('admin_roster_proposals').select('id,status,created_by,proposed_start,proposed_end').eq('title',title),'ROSTER_CREATE')
   assert.equal(proposal.status,'draft');assert.equal(proposal.created_by,office.id);assert.equal(Date.parse(proposal.proposed_start),Date.parse(start));assert.equal(Date.parse(proposal.proposed_end),Date.parse(end))
  })
  await verified(rosters('planNewShift'),async()=>{
   await invoke(ops,office,rosters('planNewShift'),{id:proposal.id,workplace:post.id,staff:alternate.id,role:'QA roster role',kind:'event'})
   const row=await find('admin_roster_proposals',proposal.id,'plan_kind,planned_user_id,planned_workplace_id')
   assert.equal(row.plan_kind,'create');assert.equal(row.planned_user_id,alternate.id);assert.equal(row.planned_workplace_id,post.id)
  })
  await verified(rosters('changeStatus'),async()=>{
   await invoke(ops,office,rosters('changeStatus'),{id:proposal.id,action:'submit'})
   assert.equal((await find('admin_roster_proposals',proposal.id,'status')).status,'submitted')
   await denied(ops,office,rosters('changeStatus'),{id:proposal.id,action:'approve'})
   await invoke(ops,head,rosters('changeStatus'),{id:proposal.id,action:'approve'})
   const row=await find('admin_roster_proposals',proposal.id,'status,reviewed_by')
   assert.equal(row.status,'approved');assert.equal(row.reviewed_by,head.id)
  })
  await verified(rosters('shiftAction'),async()=>{
   await denied(ops,office,rosters('shiftAction'),{id:proposal.id,action:'apply'})
   await invoke(ops,head,rosters('shiftAction'),{id:proposal.id,action:'apply'})
   const row=await find('admin_roster_proposals',proposal.id,'created_shift_id,applied_at,applied_by')
   assert.ok(row.applied_at);assert.equal(row.applied_by,head.id);assert.ok(row.created_shift_id)
   const shift=await find('shifts',row.created_shift_id,'user_id,workplace_id')
   assert.equal(shift.user_id,alternate.id);assert.equal(shift.workplace_id,post.id)
   await denied(ops,head,rosters('shiftAction'),{id:proposal.id,action:'apply'})
  })
 })
 await domain('billing-profile',async()=>{
  const before=await read(a.from('admin_billing_profile').select('updated_at').eq('singleton',true),'BILLING_BEFORE')
  const fields={version:before[0]?.updated_at??'',name:prefix+' QA company',street_address:'QA Street 1',postal_code:'3000',city:'Leuven',country_code:'BE',enterprise_number:'0123456749',vat_number:'BE0123456749',peppol_endpoint:'0208:0123456749',iban:'BE68539007547034'}
  let row
  await verified(component('billing-profile','save'),async()=>{
   await invoke(details,office,component('billing-profile','save'),fields)
   row=await one(a.from('admin_billing_profile').select('name,updated_at,approved_at,enterprise_number,peppol_endpoint').eq('singleton',true),'BILLING_SAVE')
   assert.equal(row.name,fields.name);assert.equal(row.enterprise_number,fields.enterprise_number);assert.equal(row.peppol_endpoint,fields.peppol_endpoint);assert.equal(row.approved_at,null)
  })
  await verified(component('billing-profile','approve'),async()=>{
   const id=component('billing-profile','approve')
   await denied(details,office,id,{version:row.updated_at})
   await invoke(details,head,id,{version:row.updated_at})
   const approved=await one(a.from('admin_billing_profile').select('approved_at,approved_by').eq('singleton',true),'BILLING_APPROVAL')
   assert.ok(approved.approved_at);assert.equal(approved.approved_by,head.id)
  })
 })
 await domain('financial-attachment',async()=>{
  const number=prefix+' Attachment draft'
  await saved('createDraft',office,{kind:'sales_invoice',document_number:number,net_amount:'10',tax_amount:'2.1'})
  const doc=await one(a.from('admin_financial_documents').select('id').eq('document_number',number),'ATTACHMENT_DRAFT')
  const pdf=()=>new File(['%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n'],'qa.pdf',{type:'application/pdf'})
  await verified(finance('uploadFinancialAttachment'),async()=>{
   const fields={document_id:doc.id,file:pdf()}
   await invoke(financeAction,office,finance('uploadFinancialAttachment'),fields)
   const row=await one(a.from('admin_financial_attachments').select('storage_path,mime_type,size_bytes,uploaded_by,sha256').eq('document_id',doc.id),'FINANCIAL_ATTACHMENT')
   assert.equal(row.mime_type,'application/pdf');assert.equal(row.uploaded_by,office.id);assert.equal(row.size_bytes,pdf().size);assert.match(row.sha256,/^[a-f0-9]{64}$/)
   await invoke(financeAction,office,finance('uploadFinancialAttachment'),{...fields,file:pdf()})
   assert.equal((await read(a.from('admin_financial_attachments').select('id').eq('document_id',doc.id),'ATTACHMENT_DEDUP')).length,1)
  })
 })
 await domain('approved-purchase-inventory-receipts',async()=>{
  const e=await newEvent('Invoice receipt',39),post=await newPost(e,'Receipt stock')
  const item=await issueItem(post,'Invoice inventory',3)
  const supplier=prefix+' Purchase supplier',number=prefix+' Purchase invoice'
  await saved('createCounterparty',office,{name:supplier,kind:'supplier',email:'qa@example.invalid',payment_terms_days:'14'})
  const vendor=await one(a.from('admin_counterparties').select('id').eq('name',supplier),'PURCHASE_VENDOR')
  const day=new Date().toISOString().slice(0,10)
  await saved('createDraft',office,{kind:'purchase_invoice',document_number:number,counterparty_id:vendor.id,event_id:e.id,issue_date:day,due_date:day,net_amount:'50',tax_amount:'10.5'})
  const doc=await one(a.from('admin_financial_documents').select('id,event_id').eq('document_number',number),'PURCHASE_DOC')
  assert.equal(doc.event_id,e.id)
  for(const [label,qty] of [['QA single',2],['QA batch',3]])await saved('addInvoiceLine',office,{document_id:doc.id,description:label,quantity:String(qty),unit_price:'10',vat_rate:'21'})
  const lines=await read(a.from('admin_financial_lines').select('id,description').eq('document_id',doc.id),'PURCHASE_LINES')
  const first=lines.find(r=>r.description==='QA single'),second=lines.find(r=>r.description==='QA batch')
  await saved('updateFinancialStatus',office,{document_id:doc.id,status:'review'})
  await saved('updateFinancialStatus',head,{document_id:doc.id,status:'approved'})
  await verified(component('inventory-receipts','receive'),async()=>{
   const id=component('inventory-receipts','receive'),fields={request:crypto.randomUUID(),line:first.id,item:item.id,quantity:'2'}
   await denied(details,office,id,fields)
   await invoke(details,head,id,fields)
   const receipt=await one(a.from('admin_inventory_receipts').select('quantity,received_by').eq('request_id',fields.request),'SINGLE_RECEIPT')
   assert.equal(receipt.quantity,2);assert.equal(receipt.received_by,head.id)
   assert.equal((await find('inventory_items',item.id,'total_quantity')).total_quantity,5)
  })
  await verified('lib/actions/admin-inventory-batch.ts#receiveAdminInventoryBatch',async()=>{
   const id='lib/actions/admin-inventory-batch.ts#receiveAdminInventoryBatch',fields={request:crypto.randomUUID(),document:doc.id,confirm:'yes',rows:JSON.stringify([{line:second.id,item:item.id,quantity:3}])}
   await invoke(people,head,id,fields,{state:true})
   await invoke(people,head,id,fields,{state:true})
   assert.equal((await find('inventory_items',item.id,'total_quantity')).total_quantity,8)
   assert.equal(sqlLocal('SELECT receipt_count FROM upt_administration_private.inventory_receipt_batches WHERE request_id='+quoteId(fields.request)),'1')
   assert.equal((await read(a.from('admin_inventory_receipts').select('quantity').eq('line_id',second.id),'BATCH_RECEIPT')).length,1)
  })
 })
 await domain('inventory-settlement-request-lifecycle',async()=>{
  // Current-work prerequisite is isolated and created only in disposable SQL.
  const returner=await c.actor('bot-10-staff-fr',false,false)
  assert.equal(sqlLocal('SELECT count(*) FROM public.shifts WHERE user_id='+quoteId(returner.id)+" AND status<>'cancelled' AND scheduled_start<now()+interval '3 hours' AND scheduled_end>now()-interval '15 minutes'"),'0','RETURNER_NO_OVERLAP')
  const e=await newEvent('Inventory return context',40),post=await newPost(e,'Return context')
  await member(e,returner)
  const shift=await createShift(e,post,returner,'Return shift')
  const item=await issueItem(post,'Return issue stock')
  await invoke(inventory,head,crew('issueInventoryItem'),{item_id:item.id,user_id:returner.id,quantity:'2'})
  const issue=await one(a.from('inventory_issues').select('id').eq('item_id',item.id).eq('user_id',returner.id),'RETURN_ISSUE')
  sqlLocal("UPDATE public.events SET start_at=now()-interval '15 minutes',start_date=now()-interval '15 minutes',end_at=now()+interval '3 hours',end_date=now()+interval '3 hours',registration_deadline=now()-interval '15 minutes' WHERE id="+quoteId(e.id))
  sqlLocal("UPDATE public.shifts SET scheduled_start=now()-interval '15 minutes',start_time=now()-interval '15 minutes',scheduled_end=now()+interval '3 hours',end_time=now()+interval '3 hours',response_status='accepted' WHERE id="+quoteId(shift.id))
  const session=crypto.randomUUID()
  sqlLocal("INSERT INTO public.work_sessions(id,user_id,event_id,shift_id,start_time,started_at,status) VALUES ("+[session,returner.id,e.id,shift.id].map(quoteId).join(",")+",now()-interval '5 minutes',now()-interval '5 minutes','active')")
  let pending
  const fields={issue_id:issue.id,condition:'returned',quantity:'2',notes:'QA return'}
  const pendingRow=()=>one(a.from('inventory_settlement_requests').select('id,status,user_id,quantity').eq('issue_id',issue.id).eq('status','pending'),'RETURN_PENDING')
  try{
   await verified(crew('requestInventorySettlement'),async()=>{
    await denied(inventory,unrelated,crew('requestInventorySettlement'),fields)
    await invoke(inventory,returner,crew('requestInventorySettlement'),fields)
    pending=await pendingRow();assert.equal(pending.user_id,returner.id);assert.equal(pending.quantity,2)
    assert.equal((await find('inventory_issues',issue.id,'outstanding_quantity')).outstanding_quantity,2)
   })
   await verified(crew('cancelInventorySettlement'),async()=>{
    await denied(inventory,unrelated,crew('cancelInventorySettlement'),{request_id:pending.id})
    await invoke(inventory,returner,crew('cancelInventorySettlement'),{request_id:pending.id})
    assert.equal((await find('inventory_settlement_requests',pending.id,'status')).status,'cancelled')
   })
   await verified(crew('decideInventorySettlement'),async()=>{
    await invoke(inventory,returner,crew('requestInventorySettlement'),fields)
    pending=await pendingRow()
    const decision={request_id:pending.id,decision:'approved',note:'QA approved return'}
    await denied(inventory,returner,crew('decideInventorySettlement'),decision)
    await invoke(inventory,head,crew('decideInventorySettlement'),decision)
    assert.equal((await find('inventory_settlement_requests',pending.id,'status')).status,'approved')
    assert.equal((await find('inventory_issues',issue.id,'outstanding_quantity')).outstanding_quantity,0)
    assert.equal((await find('inventory_items',item.id,'available_quantity')).available_quantity,8)
   })
  }finally{
   sqlLocal("UPDATE public.work_sessions SET ended_at=now(),end_time=now() WHERE id="+quoteId(session))
  }
 })
 await domain('delete-disposable-personnel',async()=>{
  // Choose an unused test identity, never a Maker, admin or real user.
  const id=sqlLocal("SELECT p.id FROM public.profiles p JOIN auth.users u ON u.id=p.id WHERE u.email LIKE 'bot-%@bots.uptilldawn.test' AND p.role='staff' AND p.approved AND p.profile_photo_url IS NULL AND NOT EXISTS(SELECT 1 FROM public.event_members m WHERE m.user_id=p.id) AND NOT EXISTS(SELECT 1 FROM public.work_attachments w WHERE w.uploaded_by=p.id) AND NOT EXISTS(SELECT 1 FROM public.upt_organization_leadership l WHERE l.user_id=p.id OR l.assigned_by=p.id) AND NOT EXISTS(SELECT 1 FROM public.upt_personnel_role_slots r WHERE r.user_id=p.id OR r.updated_by=p.id) AND NOT EXISTS(SELECT 1 FROM public.shifts sh WHERE sh.user_id=p.id OR sh.responsible_lead_id=p.id) AND NOT EXISTS(SELECT 1 FROM public.inventory_issues i WHERE i.user_id=p.id OR i.issued_by=p.id) AND p.id NOT IN ("+[head,staff,office,promoter,unrelated,alternate,maker].map(x=>quoteId(x.id)).join(',')+") ORDER BY p.id LIMIT 1")
  assert.match(id,/^[0-9a-f-]{36}$/i)
  await verified(person('deletePersonnel'),async()=>{
   // Protect the organization rather than stripping leadership references to
   // make a destructive test pass. Test both the protected and ordinary cases.
   const leaders=JSON.parse(sqlLocal("SELECT coalesce(json_agg(json_build_object('slot',slot,'user_id',user_id,'assigned_by',assigned_by) ORDER BY slot),'[]'::json) FROM public.upt_organization_leadership"))
   const protectedLeader=leaders.find(l=>l.user_id!==head.id&&l.user_id!==maker.id)
   assert.ok(protectedLeader,'EXPECTED_SEEDED_NON_HEAD_LEADERSHIP')
   await denied(safeAction,head,person('deletePersonnel'),{user_id:protectedLeader.user_id})
   assert.equal(sqlLocal('SELECT count(*) FROM auth.users WHERE id='+quoteId(protectedLeader.user_id)),'1')
   assert.deepEqual(JSON.parse(sqlLocal("SELECT coalesce(json_agg(json_build_object('slot',slot,'user_id',user_id,'assigned_by',assigned_by) ORDER BY slot),'[]'::json) FROM public.upt_organization_leadership")),leaders)
   await denied(safeAction,staff,person('deletePersonnel'),{user_id:id})
   assert.equal(sqlLocal('SELECT count(*) FROM auth.users WHERE id='+quoteId(id)),'1')
   await invoke(safeAction,head,person('deletePersonnel'),{user_id:id})
   assert.equal(sqlLocal('SELECT count(*) FROM auth.users WHERE id='+quoteId(id)),'0')
   assert.equal(sqlLocal('SELECT count(*) FROM public.profiles WHERE id='+quoteId(id)),'0')
  })
 })
}
