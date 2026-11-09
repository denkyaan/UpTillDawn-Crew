import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')

test('personnel role control uses a single atomic grant',async()=>{
 const [ui,action]=await Promise.all([read('components/admin/personnel-portal-roles.tsx'),read('lib/actions/portal-roles.ts')])
 assert.match(ui,/update\("assign_approved"\)/)
 assert.doesNotMatch(ui,/if\s*\(action\s*===\s*["']assign["']\)/)
 assert.match(action,/assign_approved/)
 assert.match(action,/!current\.isOwner && \(!current\.realIsAdmin \|\| !current\.approved \|\| current\.account_blocked\)/)
 assert.match(action,/userId === current\.id/)
})

test('database atomic grant enforces approval and duplicate protection',async()=>{
 const sql=await read('supabase/migrations/20261028213000_atomic_portal_role_approval.sql')
 assert.match(sql,/p_action='assign_approved'/)
 assert.match(sql,/values\(p_user_id,p_portal,p_role,true,v_actor,now\(\),null\)/)
 assert.match(sql,/Role already active/)
 assert.match(sql,/portal_role_.*p_action/)
 assert.match(sql,/v_actor = v_actor|p_user_id = v_actor/)
})

test('admin portal assignment read policy remains restricted to approved admins',async()=>{
 const sql=await read('supabase/migrations/20261028210000_portal_role_admin_read.sql')
 assert.match(sql,/actor\.role='admin'/)
 assert.match(sql,/actor\.approved=true/)
 assert.match(sql,/actor\.account_blocked=false/)
})

test('canonical Approvals editor changes two roles atomically without duplicate personnel forms',async()=>{
 const [crew,editor,db,action]=await Promise.all([
  read('app/(app)/crew/page.tsx'),read('components/admin/personnel-two-role-editor.tsx'),
  read('supabase/migrations/20261109130000_personnel_dual_role_editor.sql'),
  read('lib/actions/personnel-dual-roles.ts'),
 ])
 assert.doesNotMatch(crew,/PersonnelPortalRoles|setPersonnelRole/)
 for(const value of ['name="save_slot" value="1"','name="save_slot" value="2"','value="none"'])assert.ok(editor.includes(value))
 assert.match(db,/constraint upt_role_slots_distinct/)
 assert.match(db,/PERSONNEL_TWO_ROLES_CHANGED/)
 assert.match(action,/realIsAdmin/)
})

test('SQL lifecycle verifies approved entitlement, denied non-admin writes and revocation',async()=>{
 const sql=await read('tests/sql/v21-portal-role-lifecycle.sql')
 assert.match(sql,/assign_approved/)
 assert.match(sql,/Atomic approved grant not visible to recipient/)
 assert.match(sql,/Duplicate active atomic grant unexpectedly succeeded/)
 assert.match(sql,/Non-admin mutation unexpectedly succeeded/)
 assert.match(sql,/Revoked grant still authorizes recipient/)
 assert.match(sql,/^rollback;\s*$/m)
})

test('separate role management screen never submits the disabled legacy assign action',async()=>{
 const [page,form]=await Promise.all([read('app/(app)/portals/roles/page.tsx'),read('app/(app)/portals/roles/role-management-form.tsx')])
 assert.match(page,/row\.revoked_at \? "assign_approved"/)
 assert.match(form,/useState\('assign_approved'\)/)
 assert.match(form,/<option value="assign_approved">/)
 assert.doesNotMatch(form,/<option value="assign">/)
 assert.match(form,/router\.refresh\(\)/)
})

test('filtered personnel selection cannot silently submit a hidden user',async()=>{
 const form=await read('app/(app)/portals/roles/role-management-form.tsx')
 assert.match(form,/const selectedUserVisible = matches\.some\(user => user\.id === userId\)/)
 assert.match(form,/value=\{selectedUserVisible \? userId : ""\}/)
 assert.match(form,/!selectedUserVisible && <option value="" disabled>/)
 assert.match(form,/disabled=\{pending \|\| !userId \|\| !selectedUserVisible\}/)
})

test('blocked or unapproved admins never see role mutation controls',async()=>{
 const page=await read('app/(app)/portals/roles/page.tsx')
 assert.match(page,/const canManage = current\.isOwner \|\| \(current\.realIsAdmin && current\.approved && !current\.account_blocked\)/)
 assert.match(page,/canManage && <section/)
 assert.match(page,/canManage && <td/)
})

test('role listing uses the same active-admin gate as mutation controls',async()=>{
 const page=await read('app/(app)/portals/roles/page.tsx')
 assert.match(page,/if \(!canManage\) query = query\.eq\('user_id', current\.id\)/)
 assert.match(page,/const userDirectory=canManage/)
 assert.match(page,/canManage && <th/)
})
