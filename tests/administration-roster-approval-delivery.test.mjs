import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const sql=readFileSync('supabase/migrations/20261109093000_admin_roster_approval_delivery.sql','utf8')
const ui=readFileSync('app/(app)/portals/administration/rosters/page.tsx','utf8')

test('roster: Administration-only shift options expose future eligible schedule metadata',()=>{
 const section=sql.slice(sql.indexOf('create or replace function public.upt_admin_roster_shift_options'),sql.indexOf('create or replace function public.upt_admin_roster_target'))
 assert.match(section,/returns table\(id uuid,event_id uuid,scheduled_start timestamptz,scheduled_end timestamptz\)/)
 assert.match(section,/auth\.uid\(\) is null or not public\.upt_can_manage_administration\(\)/)
 assert.match(section,/s\.status='scheduled'/)
 assert.match(section,/s\.scheduled_start>now\(\)/)
 assert.match(section,/not exists\(select 1 from public\.work_sessions ws where ws\.shift_id=s\.id\)/)
 assert.match(section,/limit 1000/)
 assert.match(section,/revoke all on function public\.upt_admin_roster_shift_options\(\) from public,anon/)
})

test('roster: target and submit cannot bind an unrelated, worked or expired shift',()=>{
 const target=sql.slice(sql.indexOf('create or replace function public.upt_admin_roster_target'),sql.indexOf('create or replace function public.upt_admin_roster_submit'))
 const submit=sql.slice(sql.indexOf('create or replace function public.upt_admin_roster_submit'),sql.indexOf('create or replace function public.upt_admin_roster_apply'))
 for(const body of [target,submit]){
  assert.match(body,/v_proposal\.status<>'draft'/)
  assert.match(body,/v_proposal\.proposed_start<=now\(\)/)
  assert.match(body,/work_sessions ws where ws\.shift_id/)
  assert.match(body,/event_id/)
  assert.match(body,/status='scheduled'|status<>'scheduled'/)
 }
 assert.match(submit,/v_proposal\.target_shift_id is null/)
 assert.match(target,/v_proposal\.created_by<>auth\.uid\(\)/)
})

test('roster: approved plan calls canonical audited shift mutation instead of rejecting scheduled mirrors',()=>{
 const apply=sql.slice(sql.indexOf('create or replace function public.upt_admin_roster_apply'),sql.indexOf('create or replace function upt_administration_private.notify_roster_lifecycle'))
 assert.match(apply,/not public\.upt_is_admin\(\)/)
 assert.match(apply,/not public\.upt_is_approved\(\)/)
 assert.match(apply,/v_proposal\.status<>'approved'/)
 assert.match(apply,/v_proposal\.applied_at is not null/)
 assert.match(apply,/v_shift\.event_id<>v_proposal\.event_id/)
 assert.match(apply,/v_shift\.scheduled_start<=now\(\)/)
 assert.match(apply,/work_sessions ws where ws\.shift_id/)
 assert.match(apply,/perform public\.upt_update_shift\(/)
 assert.match(apply,/v_proposal\.proposed_start,v_proposal\.proposed_end/)
 assert.match(apply,/set applied_at=now\(\),applied_by=auth\.uid\(\)/)
 assert.doesNotMatch(apply,/v_shift\.start_time is not null|v_shift\.end_time is not null/i)
 assert.doesNotMatch(apply,/update public\.shifts set scheduled_start/i)
})

test('roster: notification lifecycle only reports committed state transitions',()=>{
 const notification=sql.slice(sql.indexOf('create or replace function upt_administration_private.notify_roster_lifecycle'))
 assert.match(notification,/old\.status='draft' and new\.status='submitted'/)
 assert.match(notification,/old\.status='submitted' and new\.status in \('approved','rejected'\)/)
 assert.match(notification,/old\.applied_at is null and new\.applied_at is not null/)
 assert.match(notification,/new\.created_by is distinct from new\.applied_by/)
 assert.match(notification,/p\.id<>new\.created_by/)
 assert.match(notification,/p\.approved=true and coalesce\(p\.account_blocked,false\)=false/)
 assert.match(notification,/upt_private\.is_app_owner\(p\.id\)/)
 assert.match(notification,/\/portals\/administration\/rosters/)
 assert.match(notification,/revoke all on function upt_administration_private\.notify_roster_lifecycle\(\)/)
 assert.match(notification,/after update of status,applied_at on public\.admin_roster_proposals/)
})

test('roster: UI exposes eligible shifts to administrative staff and never offers unlinked submit',()=>{
 assert.match(ui,/\.rpc\("upt_admin_roster_shift_options"\)/)
 assert.doesNotMatch(ui,/db\.from\("shifts"\)\.select/)
 assert.match(ui,/available\.find\(x=>x\.id===p\.target_shift_id\)/)
 assert.match(ui,/const canSubmit=creating\?Boolean\(/)
 assert.match(ui,/:Boolean\(chosen\)/)
 assert.match(ui,/canSubmit&&!shifts\.error\?/ )
 assert.match(ui,/l\.mustLink/)
 assert.match(ui,/l\.noShifts/)
 for(const locale of ['nl','fr','en','de'])assert.match(ui,new RegExp(locale+':\\{.*zone:'))
})
