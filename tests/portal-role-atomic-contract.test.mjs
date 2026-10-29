import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')

test('personnel role control uses a single atomic grant',async()=>{
 const [ui,action]=await Promise.all([read('components/admin/personnel-portal-roles.tsx'),read('lib/actions/portal-roles.ts')])
 assert.match(ui,/update\("assign_approved"\)/)
 assert.doesNotMatch(ui,/if\s*\(action\s*===\s*["']assign["']\)/)
 assert.match(action,/assign_approved/)
 assert.match(action,/current\?\.realIsAdmin/)
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

test('role management keeps self-account read-only and blocks duplicate active grants',async()=>{
 const [crew,ui]=await Promise.all([read('app/(app)/crew/page.tsx'),read('components/admin/personnel-portal-roles.tsx')])
 assert.match(crew,/readOnly=\{own\}/)
 assert.match(ui,/const activeSelected=Boolean\(selectedAssignment\?\.approved\)/)
 assert.match(ui,/activeSelected\?<span/)
 assert.match(ui,/pendingSelected\?<button/)
 assert.match(ui,/disabled=\{pending\}/)
 assert.match(ui,/router\.refresh\(\)/)
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
 assert.match(page,/current\.realIsAdmin && current\.approved && !current\.account_blocked \? await supabase\.from\('profiles'\)/)
 assert.match(page,/current\.realIsAdmin && current\.approved && !current\.account_blocked && <section/)
 assert.match(page,/current\.realIsAdmin && current\.approved && !current\.account_blocked && <td/)
})
