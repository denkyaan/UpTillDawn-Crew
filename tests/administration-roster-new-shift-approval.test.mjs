import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const sql=readFileSync('supabase/migrations/20261109094500_admin_roster_new_shift_plans.sql','utf8')
const page=readFileSync('app/(app)/portals/administration/rosters/page.tsx','utf8')

test('new-shift plan retains original update proposals and links a created shift to its audit history',()=>{
 for(const token of [
  "add column if not exists plan_kind text not null default 'update'",
  "check(plan_kind in ('update','create'))",
  "add column if not exists planned_workplace_id uuid references public.workplaces(id)",
  "add column if not exists planned_user_id uuid references public.profiles(id)",
  "add column if not exists created_shift_id uuid references public.shifts(id)",
  "create unique index if not exists admin_roster_created_shift_unique"
 ])assert.ok(sql.includes(token),token)
 assert.doesNotMatch(sql,/delete from public\.admin_roster_proposals|truncate public\.admin_roster_proposals/i)
})

test('new-shift candidate lookup is restricted to the Administration role and exposes only scheduling data',()=>{
 for(const [name,fields] of [
  ['upt_admin_roster_staff_options','returns table(event_id uuid,user_id uuid,full_name text)'],
  ['upt_admin_roster_workplace_options','returns table(event_id uuid,workplace_id uuid,name text)']
 ]){
  const body=sql.slice(sql.indexOf('create or replace function public.'+name),sql.indexOf('revoke all on function public.'+name))
  assert.ok(body.includes(fields))
  assert.ok(body.includes("auth.uid() is null or not public.upt_can_manage_administration()"))
  assert.ok(body.includes('limit 1000'))
  assert.ok(body.includes('e.archived_at is null'))
  assert.ok(sql.includes('revoke all on function public.'+name+'() from public,anon'))
  assert.ok(sql.includes('grant execute on function public.'+name+'() to authenticated'))
 }
 assert.match(sql,/coalesce\(p\.account_blocked,false\)=false/)
})

test('draft new-shift plan rejects wrong-event workplaces and unapproved personnel',()=>{
 const action=sql.slice(sql.indexOf('create or replace function public.upt_admin_roster_plan_new'),sql.indexOf('revoke all on function public.upt_admin_roster_plan_new'))
 for(const item of [
  "v_plan.status<>'draft'",
  "v_plan.created_by<>auth.uid()",
  "w.event_id=v_plan.event_id",
  "em.event_id=v_plan.event_id",
  "p.approved=true",
  "p_shift_kind not in ('event','setup','breakdown')",
  "p_role_name is null or length(trim(p_role_name)) not between 1 and 200",
  "set plan_kind='create',target_shift_id=null"
 ]) assert.ok(action.includes(item),item)
 assert.match(action,/v_plan\.proposed_start<v_start|v_plan\.proposed_start<v_start-interval/)
})

test('existing shift target clears incompatible new assignment fields',()=>{
 const target=sql.slice(sql.indexOf('create or replace function public.upt_admin_roster_target'),sql.indexOf('create or replace function public.upt_admin_roster_submit'))
 assert.match(target,/set plan_kind='update',target_shift_id=v_shift.id/)
 assert.match(target,/planned_user_id=null/)
 assert.match(target,/planned_workplace_id=null/)
 assert.match(target,/v_shift\.event_id<>v_plan\.event_id/)
 assert.match(target,/work_sessions ws/)
})

test('Admin application chooses canonical create/update, checks replay and preserves notifications',()=>{
 const submit=sql.slice(sql.indexOf('create or replace function public.upt_admin_roster_submit'),sql.indexOf('create or replace function public.upt_admin_roster_apply'))
 const apply=sql.slice(sql.indexOf('create or replace function public.upt_admin_roster_apply'))
 assert.match(submit,/if v_plan\.plan_kind='create' then/)
 assert.match(submit,/planned_workplace_id is null or v_plan\.planned_user_id is null/)
 assert.match(submit,/upt_private\.shift_capacity_would_exceed/)
 assert.match(submit,/Planned shift overlaps another assignment/)
 assert.match(submit,/Target shift is no longer assignable/)
 assert.match(apply,/not public\.upt_is_admin\(\)/)
 assert.match(apply,/not public\.upt_is_approved\(\)/)
 assert.match(apply,/if v_plan\.plan_kind='create' then/)
 assert.match(apply,/v_new_shift:=public\.upt_create_shift\(/)
 assert.match(apply,/created_shift_id=v_new_shift,applied_at=now\(\)/)
 assert.match(apply,/perform public\.upt_update_shift\(/)
 assert.match(apply,/if not found then raise exception 'Roster was already applied'/)
 assert.doesNotMatch(apply,/insert into public\.shifts|update public\.shifts set/i)
})

test('Administration UI offers staff/workplace assignment with independent Admin apply and four locales',()=>{
 assert.match(page,/async function planNewShift\(form:FormData\)/)
 assert.match(page,/\.rpc\("upt_admin_roster_plan_new"/)
 assert.match(page,/\.rpc\("upt_admin_roster_staff_options"\)/)
 assert.match(page,/\.rpc\("upt_admin_roster_workplace_options"\)/)
 assert.match(page,/p\.plan_kind==="create"/)
 assert.match(page,/creating\|\|Boolean\(p\.target_shift_id\)/)
 assert.match(page,/name="staff"/)
 assert.match(page,/name="workplace"/)
 assert.match(page,/name="role"/)
 assert.match(page,/name="kind"/)
 assert.match(page,/name="overlap"/)
 assert.match(page,/p\.created_shift_id/)
 for(const locale of ['nl','fr','en','de'])assert.match(page,new RegExp(locale+':\\{newHeading:'))
})
