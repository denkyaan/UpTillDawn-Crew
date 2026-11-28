import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=p=>readFileSync(p,'utf8')
test('signed denial evidence cannot shadow its action ledger',()=>{
 const s=read('modern/tests/qa-all-action-write-denials.mjs')
 assert.match(s,/const signedSession=await sourceReadSession/)
 assert.match(s,/db=signedSession\.db/)
 assert.match(s,/verifiedActions\.push\(\{role:bot.role,id:result.value\}\)/)
 assert.match(s,/verified:verifiedActions,failures/)
 assert.match(s,/signins!==2\|\|denials!==326\|\|failures.length/)
})
test('legacy retries cap exhausted scenarios even when intervening reads recover',()=>{
 const s=read('modern/tests/browser-auth-qa.mjs')
 assert.match(s,/consecutiveLegacyFailures>=1\|\|exhaustedLegacyScenarios>=2/)
 assert.match(s,/exhaustedLegacyScenarios\+\+/)
 assert.match(s,/signins!==7\|\|total!==56/)
 assert.match(s,/QA_STOPPED_UNHEALTHY_LEGACY_MAIN_NO_FALSE_PARITY/)
})
test('administration module skips redundant signed Admin or Maker portal lookup only',()=>{
 const s=read('app/(app)/portals/administration/modules/[slug]/page.tsx').split('export default async function AdministrationModulePage')[1]
 assert.match(s,/if\(!current.realIsAdmin&&!current.isOwner\)\{\s*const \{data,error\}=await currentPortalAssignments\(\)/)
 assert.match(s,/if\(error\|\|!canOpenPortal\("administration"/)
 assert.match(s,/if\(\(!current.approved\|\|Boolean\(current.account_blocked\)\)&&!current.isOwner\)redirect/)
})

test('administration overview alias avoids duplicate SSR while preserving protected destination and live parity',()=>{
 const config=read('next.config.mjs')
 assert.match(config,/source: '\/portals\/administration\/overview', destination: '\/portals\/administration', permanent: false/)
 const layout=read('app/(app)/portals/administration/layout.tsx')
 assert.match(layout,/if\(!user\)redirect\("\/login"\)/)
 assert.match(layout,/await currentPortalAssignments\(\)/)
 const qa=read('modern/tests/deep-route-parity-qa.mjs')
 assert.match(qa,/stage='original-overview-redirect'/)
 assert.match(qa,/await a.waitForURL\(url=>url.pathname==='\/portals\/administration'/)
 assert.match(qa,/EXPECTED!==44/)
})
test('administration read guard shares the request-scoped assignment result while mutations still check directly',()=>{
 const source=read('app/(app)/portals/administration/modules/[slug]/page.tsx')
 const [actions,page]=source.split('export default async function AdministrationModulePage')
 assert.match(page,/await currentPortalAssignments\(\)/)
 assert.doesNotMatch(page,/supabase\.rpc\("upt_my_portal_assignments"\)/)
 assert.equal((actions.match(/db\.rpc\('upt_my_portal_assignments'\)/g)||[]).length,3)
 assert.match(read('lib/portal-access-server.ts'),/currentPortalAssignments=cache\(async/)
})
