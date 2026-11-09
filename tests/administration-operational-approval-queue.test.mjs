import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const migration=readFileSync('supabase/migrations/20261109100000_admin_obligation_review_queue.sql','utf8')
const component=readFileSync('components/administration/operational-work-queue.tsx','utf8')
const parent=readFileSync('app/(app)/portals/administration/modules/[slug]/page.tsx','utf8')

test('operational review guard preserves immutable content and full state machine',()=>{
 const guard=migration.slice(migration.indexOf('create or replace function public.upt_guard_administration_obligation'),migration.indexOf('create or replace function upt_administration_private.notify_obligation_review'))
 assert.match(guard,/new\.approved_by is distinct from old\.approved_by/)
 assert.match(guard,/new\.status<>old\.status/)
 assert.match(guard,/new\.status='submitted'/)
 assert.match(guard,/new\.status in \('approved','rejected'\)/)
 assert.match(guard,/new\.status='completed'/)
 assert.match(guard,/new\.status='cancelled'/)
 assert.match(guard,/public\.upt_is_admin\(\)/)
 assert.match(guard,/old\.created_by=auth\.uid\(\)/)
 assert.match(guard,/The submitter cannot review their own dossier/)
 assert.match(guard,/new\.approved_by:=auth\.uid\(\)/)
 assert.match(guard,/length\(btrim\(new\.review_note\)\)<3/)
 assert.match(guard,/new\.updated_at:=now\(\)/)
})

test('review notifications use a private trigger and only committed status changes',()=>{
 const notification=migration.slice(migration.indexOf('create or replace function upt_administration_private.notify_obligation_review'))
 assert.match(notification,/old\.status is not distinct from new\.status/)
 assert.match(notification,/new\.kind not in \('logistics','permits','tasks'\)/)
 assert.match(notification,/p\.id<>new\.created_by/)
 assert.match(notification,/p\.approved=true/)
 assert.match(notification,/coalesce\(p\.account_blocked,false\)=false/)
 assert.match(notification,/new\.created_by/)
 assert.match(notification,/insert into public\.crew_notifications/)
 assert.match(notification,/after update of status on public\.admin_operational_obligations/)
 assert.match(notification,/revoke all on function upt_administration_private\.notify_obligation_review/)
 assert.match(notification,/admin_operational_obligations_kind_status_due_idx/)
})

test('operational queue paginates and orders all records deterministically',()=>{
 assert.match(component,/const pageSize=50/)
 assert.match(component,/count:'exact'/)
 assert.match(component,/\.eq\('kind',kind\)/)
 assert.match(component,/\.eq\('status',status\)/)
 assert.match(component,/\.order\('due_at',\{ascending:true\}\)/)
 assert.match(component,/\.order\('id',\{ascending:true\}\)\.range\(offset,offset\+pageSize-1\)/)
 assert.match(component,/count>currentPage\*pageSize/)
 assert.match(component,/pageHref\(currentPage\+1\)/)
 assert.doesNotMatch(component,/\.limit\(100\)/)
})

test('operational queue refuses submitting own review even with forged form data',()=>{
 const action=component.slice(component.indexOf('async function saveCase('),component.indexOf('export default async function OperationalWorkQueue'))
 assert.match(action,/if\(\['approved','rejected'\]\.includes\(action\)\)/)
 assert.match(action,/caseRow\.created_by===access\.user\.id/)
 assert.match(action,/\.eq\('status','submitted'\)/)
 assert.match(action,/Independent Admin reviewer required/)
 assert.match(component,/row\.created_by!==access\.user\.id/)
 assert.match(component,/row\.created_by===access\.user\.id/)
})

test('all 3 dedicated pages actually forward status and page query parameters',()=>{
 assert.match(parent,/status:requestedCaseStatus/)
 assert.match(parent,/statusFilter=\{requestedCaseStatus\}/)
 assert.match(parent,/page=\{listPage\(requestedPage,10000\)\}/)
 for(const slug of ['tasks','logistics','permits']){
  const wrapper=readFileSync('app/(app)/portals/administration/modules/'+slug+'/page.tsx','utf8')
  assert.match(wrapper,/searchParams:Promise<\{page\?:string;status\?:string\}>/)
  assert.match(wrapper,/AdministrationModulePage\(\{params:Promise\.resolve\(\{slug:/)
  assert.match(wrapper,/,searchParams\}\)/)
 }
 for(const locale of ['nl','fr','en','de'])
  assert.match(component,new RegExp(locale+':\\{filter:'))
})
