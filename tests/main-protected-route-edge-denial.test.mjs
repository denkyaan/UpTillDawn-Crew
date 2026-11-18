import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const middleware=readFileSync('lib/supabase/middleware.ts','utf8')
const app=readFileSync('app/(app)/admin/page.tsx','utf8')
const finance=readFileSync('app/(app)/portals/administration/finance/page.tsx','utf8')

test('admin and finance deny unauthorized users in verified edge proxy before full SSR',()=>{
 assert.match(middleware,/pathname === '\/admin' \|\| pathname\.startsWith\('\/admin\/'\)/)
 assert.match(middleware,/pathname === '\/portals\/administration\/finance'/)
 assert.match(middleware,/if \(authenticated && \(isAdminArea \|\| isFinanceArea\)\)/)
 assert.match(middleware,/supabase\.rpc\('upt_current_effective_role'\)/)
 assert.match(middleware,/if \(effectiveRole !== 'admin'\) return redirectDenied\('\/'\)/)
 assert.match(middleware,/const requiresEarlyRoleCheck/)
 assert.match(middleware,/pathname\.startsWith\('\/admin\/'\) \|\| isFinanceArea/)
 assert.match(middleware,/supabase\.rpc\('upt_can_manage_administration'\)/)
 assert.match(middleware,/if \(canManage !== true\) return redirectDenied\('\/portals'\)/)
 assert.doesNotMatch(middleware,/supabase\.rpc\('upt_my_portal_assignments'\)/)
})
test('authz backend outage is not mislabeled role denial; server pages remain authoritative',()=>{
 assert.match(middleware,/if \(error\) return authzUnavailable\(\)/)
 assert.match(middleware,/if \(canManage !== true\) return redirectDenied\('\/portals'\)/)
 assert.doesNotMatch(middleware,/if \(error\) return redirectDenied\(/)
 assert.match(middleware,/status: 503/)
 assert.match(middleware,/supabaseResponse\.cookies\.getAll\(\)\.forEach/)
 assert.match(app,/getCurrentUser\(\);if\(!current\?\.isAdmin\) redirect\('\/'\)/)
 assert.match(finance,/async function requireAdministration\(\)/)
 assert.match(finance,/canOpenPortal\('administration'/)
 assert.doesNotMatch(middleware,/user_metadata|localStorage|sessionStorage/)
})
