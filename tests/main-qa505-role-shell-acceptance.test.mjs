import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const read=path=>readFileSync(path,'utf8')
const shell=read('components/layout/app-layout.tsx')
const fallback=read('components/layout/lazy-app-layout.tsx')
const tasks=read('components/crew/staff-tasks-client.tsx')
const portal=read('app/(app)/portals/[portal]/page.tsx')
const browser=read('scripts/e2e-seven-main-bots.mjs')

test('unassigned Staff can view Tasks landing without bypassing configured role visibility',()=>{
 assert.match(shell,/const taskLandingVisible=Boolean\(currentFeature==="tasks"/)
 assert.match(shell,/roleKey==="staff"\|\|roleKey==="responsible_lead"/)
 assert.match(shell,/currentRule\?\.visible===true&&currentRule\?\.enabled===true/)
 assert.match(shell,/currentRule\?\.condition_key==="shift_active"/)
 assert.match(shell,/currentVisible=adminAlwaysRoute\|\|taskLandingVisible/)
 assert.match(shell,/currentUsable=taskLandingVisible/)
 assert.match(tasks,/!loading&&!error&&!hasOpenAssigned/)
 assert.match(tasks,/!loading&&!error&&active/)
 const staffRoute=read('app/(app)/tasks/page.tsx')
 const managerRoute=read('app/(app)/tasks/manager-page.tsx')
 assert.ok(staffRoute.includes("await getCurrentUser()"))
 assert.ok(staffRoute.includes("if(user.role==='staff')return <LazyStaffTasks"))
 assert.ok(managerRoute.includes("await getCurrentUser()"))
 assert.ok(managerRoute.includes("ManagerOnly"))
 assert.ok(shell.includes('ruleMap.get("tasks")?.visible===true'))

})
test('full shell must hydrate and loading fallback provides safe authenticated links',()=>{
 assert.match(shell,/data-app-shell-ready="true"/)
 assert.match(fallback,/data-shell-fallback-navigation="true"/)
 assert.match(fallback,/href="\/events"/)
 assert.match(fallback,/href="\/chat"/)
 assert.match(browser,/data-app-shell-ready="true"/)
 assert.match(browser,/Worker exceeded resource limits/)
})
test('Administration uses one request-cached authorization lookup and browser-first locale',()=>{
 assert.match(portal,/import \{ currentPortalAssignments \}/)
 assert.match(portal,/await currentPortalAssignments\(\)/)
 assert.match(portal,/const locale = await requestUiLocale\(\)/)
 assert.doesNotMatch(portal,/cookieLocale \?\? parseAcceptLanguage/)
 assert.match(read('lib/portal-access-server.ts'),/cache\(async/)
 assert.match(read('app\/(app)\/portals\/administration\/layout.tsx'),/currentPortalAssignments\(\)/)
})
