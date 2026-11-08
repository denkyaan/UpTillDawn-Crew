import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {gotoReady,browserTimeoutMs} from './browser-navigation.mjs'

async function submit(page,button){
 const current=new URL(page.url())
 const [response]=await Promise.all([
  page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname===current.pathname&&new URL(r.url()).origin===current.origin,{timeout:browserTimeoutMs}),
  button.click(),
 ])
 assert.ok(response.status()<400,'Promotion server action returned '+response.status())
 assert.ok(!response.headers()['x-action-redirect']?.includes('action_error='),'Promotion action rejected the submitted form')
}
const record=async query=>{const {data,error}=await query.single();assert.ifError(error);return data}

export async function promotionTaskWorkflow({base,prefix,adminPage,promotionPage,admin,promo,office,staff,created,ok,browser,browserContext}){
 const route='/admin/management/promotion-tasks'
 await gotoReady(adminPage,base+route)
 const form=adminPage.locator('section[aria-label="Create general promotion task"] form:visible')
 const taskId=await form.locator('input[name="request"]').inputValue()
 const title=prefix+' Promotion campaign',updatedTitle=title+' updated'
 await form.getByLabel('Task name',{exact:true}).fill(title)
 await form.getByLabel('Description and publication links').fill('Share the official campaign on Instagram and Facebook.')
 await form.locator('select[name="user_id"]').selectOption(promo.user.id)
 await submit(adminPage,form.getByRole('button',{name:'Create task',exact:true}))
 await adminPage.waitForURL(u=>u.pathname===route&&u.searchParams.get('saved')==='1')
 await adminPage.locator('li:visible').filter({hasText:title}).waitFor({state:'visible'})
 created.taskIds??=[];created.taskIds.push(taskId)
 const task=await record(admin.db.from('tasks').select('id,title,event_id,promotion_only,updated_at').eq('id',taskId))
 assert.equal(task.event_id,null);assert.equal(task.promotion_only,true);assert.equal(task.title,title)
 const assignment=await record(promo.db.from('task_assignments').select('id,status,confirmed_at').eq('task_id',taskId).eq('user_id',promo.user.id))
 assert.equal(assignment.status,'NOT STARTED');assert.equal(assignment.confirmed_at,null)
 const replay=await admin.db.rpc('upt_admin_create_promotion_task',{p_request:taskId,p_title:title,p_description:'Share the official campaign on Instagram and Facebook.',p_users:[promo.user.id]})
 assert.ifError(replay.error);assert.equal(replay.data,taskId)
 const {count,error:countError}=await admin.db.from('task_assignments').select('id',{count:'exact',head:true}).eq('task_id',taskId)
 assert.ifError(countError);assert.equal(count,1)
 for(const actor of [office,staff]){
  const forbidden=await actor.db.rpc('upt_admin_create_promotion_task',{p_request:randomUUID(),p_title:'Unauthorized',p_description:'',p_users:[promo.user.id]})
  assert.equal(forbidden.error?.code,'42501')
 }
 ok('Admin mobile UI creates a general promotion task; exact replay and denied employee creation preserve assignments')

 await gotoReady(promotionPage,base+'/portals/promotion/tasks')
 const ownCard=()=>promotionPage.locator(`li:visible:has(input[name="assignment_id"][value="${assignment.id}"])`)
 await submit(promotionPage,ownCard().getByRole('button',{name:'Start',exact:true}))
 await ownCard().locator('input[name="evidence"]').waitFor({state:'visible'})
 const started=await record(promo.db.from('task_assignments').select('status,confirmed_at').eq('id',assignment.id))
 assert.equal(started.status,'IN PROGRESS');assert.ok(started.confirmed_at)
 ok('Promotion Start confirms and starts event-independent work through the real mobile form')

 const editPanel=adminPage.locator(`details:visible:has(input[name="task_id"][value="${taskId}"])`)
 await editPanel.locator('summary').click()
 const editForm=editPanel.locator('form:visible')
 await editForm.getByLabel('Task name',{exact:true}).fill(updatedTitle)
 await submit(adminPage,editForm.getByRole('button',{name:'Save changes',exact:true}))
 await adminPage.locator('li:visible').filter({hasText:updatedTitle}).waitFor({state:'visible'})
 const changed=await record(promo.db.from('task_assignments').select('status,confirmed_at').eq('id',assignment.id))
 assert.equal(changed.status,'IN PROGRESS');assert.equal(changed.confirmed_at,null)
 const stale=await admin.db.rpc('upt_admin_update_promotion_task',{p_task:taskId,p_title:'Stale overwrite',p_description:'',p_expected_updated_at:task.updated_at})
 assert.equal(stale.error?.code,'40001')
 await gotoReady(promotionPage,base+'/portals/promotion/tasks')
 assert.equal(await ownCard().locator('input[name="evidence"]').count(),0)
 await submit(promotionPage,ownCard().getByRole('button',{name:'Confirm changes',exact:true}))
 await ownCard().locator('input[name="evidence"]').waitFor({state:'visible'})
 ok('Task edits reject stale saves and require Promotion to confirm changed instructions before evidence upload')

 // A real tiny PNG exercises file signature, private storage and DB registration.
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')
 await ownCard().locator('input[name="evidence"]').setInputFiles({name:'promotion-proof.png',mimeType:'image/png',buffer:png})
 await submit(promotionPage,ownCard().getByRole('button',{name:'Submit evidence',exact:true}))
 await ownCard().locator('time').waitFor({state:'visible'})
 const evidence=await record(promo.db.from('promotion_evidence').select('id,verification_status,storage_path').eq('assignment_id',assignment.id))
 assert.ok(evidence.storage_path.startsWith(promo.user.id+'/promotion/'))
 assert.notEqual(evidence.verification_status,'verified','Upload must not automatically certify publication')
 const forged=await staff.db.rpc('upt_admin_review_promotion_evidence',{p_evidence:evidence.id,p_status:'verified',p_details:'Unauthorized employee review'})
 assert.equal(forged.error?.code,'42501')
 await gotoReady(adminPage,base+'/admin/management/promotion-discipline')
 const review=adminPage.locator(`form:visible:has(input[name="evidence_id"][value="${evidence.id}"])`)
 await review.locator('select[name="status"]').selectOption('verified')
 await review.locator('textarea[name="reason"]').fill('Controlled test image reviewed by Admin.')
 await submit(adminPage,review.getByRole('button',{name:'Save review',exact:true}))
 await review.waitFor({state:'detached'})
 const completed=await record(promo.db.from('task_assignments').select('status').eq('id',assignment.id))
 assert.equal(completed.status,'COMPLETED')
 assert.equal((await record(promo.db.from('promotion_evidence').select('verification_status').eq('id',evidence.id))).verification_status,'verified')
 await gotoReady(promotionPage,base+'/portals/promotion/tasks')
 const completedCard=promotionPage.locator('li:visible').filter({hasText:updatedTitle})
 assert.ok((await completedCard.innerText()).includes('Completed'))
 assert.equal(await completedCard.locator('input[type="file"]').count(),0)
 ok('Promotion uploads private image evidence; only Admin review completes the assignment and updates its visible history')

 const headings={nl:'Algemene promotietaak aanmaken',fr:'Créer une tâche promotionnelle générale',en:'Create general promotion task',de:'Allgemeine Promotionsaufgabe erstellen'}
 for(const locale of Object.keys(headings)){
  const context=await browserContext(browser,admin,locale),tab=await context.newPage()
  try{
   await gotoReady(tab,base+route)
   assert.equal(await tab.getByRole('heading',{name:headings[locale],exact:true}).count(),1)
  }finally{await context.close()}
 }
 ok('General promotion task creation renders in all four supported languages')
}
