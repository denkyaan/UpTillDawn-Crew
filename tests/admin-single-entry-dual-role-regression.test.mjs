import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
test('role assignment screen contains two separate form saves and optional second role',()=>{
 const page=read('app/(app)/personnel/page.tsx')
 const component=read('components/admin/personnel-two-role-editor.tsx')
 const action=read('lib/actions/personnel-dual-roles.ts')
 assert.match(page,/PersonnelTwoRoleEditor/)
 assert.match(component,/name="save_slot" value="1"/)
 assert.match(component,/name="save_slot" value="2"/)
 assert.match(component,/name="role_one"/)
 assert.match(component,/name="role_two"/)
 assert.match(component,/value="none"/)
 assert.match(component,/PersonnelTwoRoleEditor/)
 assert.match(action,/upt_admin_set_two_personnel_roles/)
 assert.match(action,/confirm_head/)
 for(const loc of ['nl:','fr:','en:','de:'])assert.ok(component.includes(loc))
})
test('single source of Admin role changes enforces authorized RPC and sole Head',()=>{
 const migration=read('supabase/migrations/20261109122422_personnel_dual_role_editor.sql')
 for(const token of ['security definer',"upt_admin_set_two_personnel_roles","upt_is_admin(v_actor)","upt_is_approved()",
  "p_role_two='none'",'upt_leadership_assign','upt_personnel_role_slots','upt_audit_logs',
  "updated_by","role_two is null or role_two<>role_one","v_current_role='admin' and v_head is null"])assert.ok(migration.includes(token),token)
 assert.match(migration,/grant execute on function public\.upt_admin_set_two_personnel_roles[\s\S]*to authenticated/)
 assert.match(migration,/revoke all on public\.upt_personnel_role_slots from public,anon,authenticated/)
 assert.match(migration,/Explicit confirmation required for Head Admin transfer/)
})
test('Admin overview has no duplicate shortcuts, floating chat or separate inline AI',()=>{
 const layout=read('components/layout/app-layout.tsx')
 const dash=read('app/(app)/admin/page.tsx')
 const topbar=read('components/layout/topbar.tsx')
 assert.match(layout,/const showFloatingChat=showChat&&!inDedicatedPortal&&!navigationExpanded/)
 assert.match(layout,/adminAiAction/)
 assert.match(topbar,/adminAiAction/)
 assert.doesNotMatch(dash,/href="\/admin\/management"/)
 assert.doesNotMatch(dash,/<PlatformAiAssistant\s*\/>/)
 const crew=read('app/(app)/crew/page.tsx')
 assert.doesNotMatch(crew,/PersonnelPortalRoles/)
 assert.doesNotMatch(crew,/form action=\{setPersonnelRole\}/)
})

test('Admin portal chooser never exposes a second role mutation entry',()=>{
 const chooser=read('app/(app)/portals/page.tsx')
 const legacy=read('app/(app)/portals/roles/page.tsx')
 assert.match(chooser,/!current\.realIsAdmin&&<Link href="\/portals\/roles"/)
 assert.match(legacy,/if\(current\.realIsAdmin && current\.approved && !current\.account_blocked\)redirect\('\/personnel'\)/)
})
