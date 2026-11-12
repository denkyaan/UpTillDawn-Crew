import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')

test('Admin floating chat remains on home and AI hides only while a subtab menu is expanded',()=>{
 const layout=read('components/layout/app-layout.tsx')
 assert.match(layout,/const showFloatingChat=showChat&&!inDedicatedPortal&&!navigationExpanded/)
 assert.doesNotMatch(layout,/pathname!=="\/admin"/)
 assert.match(layout,/const adminAiVisible=\(isAdmin\|\|administrationPortal\)&&!navigationExpanded/)
 assert.match(layout,/const adminAiAction=adminAiVisible\?/)
 assert.match(layout,/if\(open\)setAdminAiOpen\(false\)/)
})
test('iPhone uses a screen-bounded AI panel, two-column subtabs and compact context',()=>{
 const [layout,nav,context]=['components/layout/app-layout.tsx','components/layout/mobile-nav.tsx','components/admin/admin-context-bar.tsx'].map(read)
 assert.match(layout,/fixed inset-x-3 top-/)
 assert.match(layout,/sm:absolute sm:inset-x-auto/)
 assert.match(nav,/grid-cols-3 gap-1\.5/)
 assert.match(nav,/item=\{item\} expandedItem/)
 assert.doesNotMatch(context,/ContextLink/)
 assert.match(context,/overflow-x-auto whitespace-nowrap/)
})
test('role save failures stay inside form, including invalid deputy pairing',()=>{
 const [editor,action,personnel]=['components/admin/personnel-two-role-editor.tsx','lib/actions/personnel-dual-roles.ts','app/(app)/personnel/page.tsx'].map(read)
 assert.match(editor,/useActionState\(savePersonnelRoleSlot,initialState\)/)
 assert.match(editor,/role="alert"/)
 assert.match(editor,/leadershipRoles\.includes\(one\)&&leadershipRoles\.includes\(two\)/)
 assert.match(action,/return \{error:'Deze combinatie van twee rollen is niet toegestaan/)
 assert.match(personnel,/<details className="rounded-xl border p-3"/)
})
