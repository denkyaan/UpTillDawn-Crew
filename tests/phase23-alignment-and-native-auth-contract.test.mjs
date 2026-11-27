import test from 'node:test'
import assert from 'node:assert/strict'
import {existsSync,readFileSync} from 'node:fs'
const read=p=>readFileSync(p,'utf8')
test('phase 2+3 alignment manifest uses existing ordered migrations only and no live executor',()=>{
 const plan=JSON.parse(read('scripts/phase23-environment-alignment.json'))
 assert.equal(plan.main.expectedFailed.length,3)
 assert.equal(plan.production.expectedFailed.length,11)
 for(const target of [plan.main,plan.production]){
  assert.deepEqual(target.migrations,[...new Set(target.migrations)].sort())
  for(const file of target.migrations)assert.ok(existsSync('supabase/migrations/'+file))
 }
 const qa=read('modern/tests/qa-local-alignment-rehearsal.mjs')
 assert.match(qa,/assert\.equal\(process\.env\.BOT_DB_URL,pg\)/)
 assert.match(qa,/ROLLBACK;/)
 assert.match(qa,/productionCompatibilityVerified:false/)
 assert.doesNotMatch(qa,/supabase db push|apply_migration/)
})
test('remaining acceptance keeps live gates intact and provider contract separate from persisted positive IDs',()=>{
 const workflow=read('.github/workflows/fast-change-validation.yml')
 const isolated=workflow.split('\n  phase-two-three-local-acceptance:\n')[1].split('\n  release-production:\n')[0]
 assert.match(isolated,/qa-local-alignment-rehearsal\.mjs/)
 assert.match(isolated,/qa-local-native-auth-parity\.mjs/)
 assert.doesNotMatch(isolated,/wrangler deploy|supabase db push/)
 const auth=read('modern/tests/qa-local-native-auth-parity.mjs')
 assert.match(auth,/executeOriginalAuth\(new NextRequest\(req\)\)/)
 assert.match(auth,/isNativeAuthProject\(native,dbUrl\),false/)
 assert.match(auth,/deployedWorkerVerified:false/)
 const provider=read('modern/tests/qa-local-native-expanded-domains.mjs')
 assert.match(provider,/READ_ONLY_REFRESH_MUTATED_LEDGER/)
 assert.doesNotMatch(provider,/verified\(agreement\('refreshSigning'\)/)
})
