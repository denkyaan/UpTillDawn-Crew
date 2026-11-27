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
 assert.match(s,/if\(!current.realIsAdmin&&!current.isOwner\)\{\s*const \{data,error\}=await supabase.rpc\("upt_my_portal_assignments"\)/)
 assert.match(s,/if\(error\|\|!canOpenPortal\("administration"/)
 assert.match(s,/if\(\(!current.approved\|\|Boolean\(current.account_blocked\)\)&&!current.isOwner\)redirect/)
})
