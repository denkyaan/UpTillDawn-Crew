import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const page=readFileSync('app/(app)/portals/administration/promotion-tasks/page.tsx','utf8')
const layout=readFileSync('app/(app)/portals/administration/layout.tsx','utf8')

test('authorized administration personnel can open promotion tasks through portal layout',()=>{
 assert.match(layout,/canOpenPortal\("administration"/)
 assert.match(page,/getCurrentUser\(\)/)
 assert.doesNotMatch(page,/!actor\.isAdmin&&!actor\.isOwner/)
 assert.ok(page.includes('"/portals/administration/promotion-discipline"'))
})

test('administration promotion tasks support filtered stable pagination',()=>{
 const page=readFileSync('app/(app)/portals/administration/promotion-tasks/page.tsx','utf8')
 assert.ok(page.includes('tasksQuery.ilike("title"'))
 assert.ok(page.includes('.order("created_at",{ascending:false}).order("id",{ascending:false}).range(offset,offset+pageSize)'))
 assert.ok(page.includes('name="q" defaultValue={q}'))
 assert.ok(page.includes('href={pageHref(page+1)}'))
 for(const label of ['Zoek promotietaken','Rechercher des tâches','Search promotion tasks','Promotionsaufgaben suchen'])assert.ok(page.includes(label))
})

test('promotion task overview exposes instructions and event scope in four languages',()=>{
 assert.ok(page.includes('.select("id,title,description,event_id,created_at,updated_at,promotion_only")'))
 assert.ok(page.includes('task.description&&'))
 assert.ok(page.includes('task.event_id?'))
 for(const label of ['Algemene taak','Tâche générale','General task','Allgemeine Aufgabe'])assert.ok(page.includes(label))
})

test('promotion task scope filters are database-side and survive pagination',()=>{
 assert.ok(page.includes('tasksQuery.not("event_id","is",null)'))
 assert.ok(page.includes('tasksQuery.is("event_id",null)'))
 assert.ok(page.includes('name="scope" defaultValue={scope}'))
 assert.ok(page.includes('...(scope!=="all"?{scope}:{})'))
 for(const label of ['Alle taken','Toutes les tâches','All tasks','Alle Aufgaben'])assert.ok(page.includes(label))
})

test('promotion task assignment totals are scoped to admin-visible rows',()=>{
 assert.ok(page.includes('(actor.realIsAdmin||actor.isOwner)&&taskIds.length'))
 assert.ok(page.includes('db.from("task_assignments").select("id,task_id,user_id,status,confirmed_at",{count:"exact"}).in("task_id",taskIds)'))
 assert.ok(page.includes('(actor.realIsAdmin||actor.isOwner)&&!assignmentError'))
 assert.ok(page.includes('assignmentCounts.get(task.id)??0'))
 for(const label of ['Toewijzingen','Affectations','Assignments','Zuweisungen'])assert.ok(page.includes(label))
})

test('promotion task assignment uses admin-only audited RPC and requires event scope',()=>{
 assert.ok(page.includes('async function assignPromotionTask(form:FormData)'))
 assert.ok(page.includes('!actor.realIsAdmin&&!actor.isOwner'))
 assert.ok(page.includes('!target?.event_id'))
 assert.ok(page.includes('db.rpc("upt_assign_task",{p_task:task,p_user:user})'))
 assert.ok(page.includes('action={assignPromotionTask}'))
 for(const label of ['Medewerker toewijzen','Affecter un membre','Assign staff member','Mitarbeiter zuweisen'])assert.ok(page.includes(label))
})

test('administrators can revoke task assignments through existing authorized RPC',()=>{
 assert.ok(page.includes('async function removePromotionAssignment(form:FormData)'))
 assert.ok(page.includes('db.rpc("upt_remove_task_assignment",{p_assignment:id})'))
 assert.ok(page.includes('action={removePromotionAssignment}'))
 assert.ok(page.includes('assignmentsByTask.get(task.id)'))
 for(const label of ['Toewijzing verwijderen','Supprimer l’affectation','Remove assignment','Zuweisung entfernen'])assert.ok(page.includes(label))
})

test('promotion assignments use approved event-member picker instead of UUID entry',()=>{
 assert.ok(page.includes('db.from("event_members").select("event_id,user_id",{count:"exact"})'))
 assert.ok(page.includes('db.from("profiles").select("id,full_name",{count:"exact"}).eq("approved",true)'))
 assert.ok(page.includes('<select name="user_id" required'))
 assert.ok(page.includes('assignmentsByTask.get(task.id)??[]'))
 assert.ok(!page.includes('<input name="user_id" required pattern='))
 for(const label of ['Kies een medewerker','Choisir un membre','Choose a staff member','Mitarbeiter auswählen'])assert.ok(page.includes(label))
})

test('assignment management shows member names and refuses incomplete member directories',()=>{
 assert.ok(page.includes('names.get(assignment.user_id)??assignment.user_id'))
 assert.ok(page.includes('if(offset===9000)memberListTruncated=true'))
 assert.ok(page.includes('!memberListTruncated&&!assignmentError&&!assignmentOverflow&&<form'))
 assert.ok(page.includes('membersError||profilesError||memberListTruncated'))
})

test('event membership and profile lookup support bounded server-side batches',()=>{
 assert.ok(page.includes('for(let offset=0;offset<10000;offset+=1000)'))
 assert.ok(page.includes('.order("event_id").order("user_id").range(offset,offset+999)'))
 assert.ok(page.includes('for(let offset=0;offset<memberIds.length;offset+=200)'))
 assert.ok(page.includes('memberIds.slice(offset,offset+200)'))
 assert.ok(page.includes('if(offset===9000)memberListTruncated=true'))
})

test('promotion assignment controls fail closed on incomplete result sets',()=>{
 assert.ok(page.includes('.select("id,task_id,user_id,status,confirmed_at",{count:"exact"}).in("task_id",taskIds).limit(1000)'))
 assert.ok(page.includes('const assignmentOverflow=assignmentTotal===null||assignmentTotal>(assignments?.length??0)'))
 assert.ok(page.includes('!assignmentError&&!assignmentOverflow&&<form'))
 assert.ok(page.includes('!assignmentError&&!assignmentOverflow&&<section'))
 assert.ok(page.includes('assignmentError||assignmentOverflow'))
 assert.ok(page.includes('"/admin/management":"/portals/administration/modules/marketing"'))
})

test('promotion assignment server action rejects forged non-member or unapproved user IDs',()=>{
 const action=page.slice(page.indexOf('async function assignPromotionTask('),page.indexOf('async function removePromotionAssignment('))
 assert.ok(action.includes('.from("event_members").select("user_id").eq("event_id",target.event_id).eq("user_id",user).maybeSingle()'))
 assert.ok(action.includes('if(membershipError||!membership)throw'))
 assert.ok(action.includes('.from("profiles").select("id").eq("id",user).eq("approved",true).maybeSingle()'))
 assert.ok(action.includes('if(profileError||!profile)throw'))
 assert.ok(action.indexOf('if(profileError||!profile)throw')<action.indexOf('db.rpc("upt_assign_task"'))
})

test('promotion task server actions apply the same owner exception as admin page access',()=>{
 const assign=page.slice(page.indexOf('async function assignPromotionTask('),page.indexOf('async function removePromotionAssignment('))
 const remove=page.slice(page.indexOf('async function removePromotionAssignment('),page.indexOf('export default async function AdministrationPromotionTasks('))
 for(const action of [assign,remove]){
  assert.ok(action.includes('(actor.account_blocked&&!actor.isOwner)'))
  assert.ok(action.includes('!actor.approved&&!actor.isOwner'))
  assert.ok(action.includes('!actor.realIsAdmin&&!actor.isOwner'))
 }
 assert.ok(page.includes('adminView&&(!actor.realIsAdmin&&!actor.isOwner||!actor.approved&&!actor.isOwner||actor.account_blocked&&!actor.isOwner)'))
})

test('event membership paging compares exact count before reporting overflow',()=>{
 assert.ok(page.includes('.select("event_id,user_id",{count:"exact"}).in("event_id",eventIds)'))
 assert.ok(page.includes('if(pageError||memberTotal===null){membersError=true;break}'))
 assert.ok(page.includes('if(membershipPages.length>=memberTotal)break'))
 assert.ok(page.includes('if((data?.length??0)<1000){memberListTruncated=true;break}'))
})

test('promotion assignment removal cannot be used to revoke unrelated non-event tasks',()=>{
 const action=page.slice(page.indexOf('async function removePromotionAssignment('),page.indexOf('export default async function AdministrationPromotionTasks('))
 assert.ok(action.includes('db.from("task_assignments").select("task_id").eq("id",id).maybeSingle()'))
 assert.ok(action.includes('db.from("tasks").select("id,event_id").eq("id",assignment.task_id).maybeSingle()'))
 assert.ok(action.includes('if(taskLookupError||!eventTask?.event_id)throw'))
 assert.ok(action.indexOf('if(taskLookupError||!eventTask?.event_id)throw')<action.indexOf('db.rpc("upt_remove_task_assignment"'))
})

test('approved profile directory fails closed if database returns a partial batch',()=>{
 assert.ok(page.includes('.select("id,full_name",{count:"exact"}).eq("approved",true).in("id",memberIds.slice(offset,offset+200))'))
 assert.ok(page.includes('if(batchError||profileTotal===null||profileTotal>(data?.length??0)){profilesError=true;break}'))
 assert.ok(page.includes('!membersError&&!profilesError&&!memberListTruncated'))
})
