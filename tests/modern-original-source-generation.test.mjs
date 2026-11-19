import test from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
const read=p=>readFileSync(p,'utf8')
test('generated original actions and API allowlist match their current source',()=>{
 for(const file of ['modern/scripts/generate-original-actions.mjs','modern/scripts/generate-main-api-routes.mjs']){
  const output=execFileSync(process.execPath,[file,'--check'],{encoding:'utf8'})
  assert.match(output,/generatedFiles|originalApiRoutes/)
 }
})
test('original business action execution stays behind Main QA, CSRF and verified identity',()=>{
 const boundary=read('lib/migration/main-qa-boundary.ts'),route=read('app/api/migration/actions/route.ts')
 assert.match(boundary,/NEXT_PUBLIC_APP_URL==='https:\/\/uptilldawn-main.uptilldawn.workers.dev'/)
 assert.match(boundary,/NEXT_PUBLIC_SUPABASE_URL==='https:\/\/npbjrtiolqperdgljnhi.supabase.co'/)
 assert.match(boundary,/request.headers.get\('origin'\)/)
 assert.ok(route.indexOf('migrationRequestAllowed(request)')<route.indexOf('originalActions[id]()'))
 assert.ok(route.indexOf('await getCurrentUser()')<route.indexOf('originalActions[id]()'))
 assert.match(route,/Object.hasOwn\(originalActions,id\)/)
 assert.match(route,/boundedMigrationForm/)
 assert.doesNotMatch(route,/import\(id|eval\(|new Function|SERVICE_ROLE/)
})
test('original offline and push worker stays byte-identical, with the original update handshake',()=>{
 assert.equal(read('modern/public/sw.js'),read('public/sw.js'))
 const worker=read('modern/public/sw.js')
 for(const event of ['push','notificationclick','pushsubscriptionchange','periodicsync'])assert.ok(worker.includes("addEventListener('"+event+"'"))
 assert.ok(worker.includes('UPT_ACTIVATE_UPDATE'))
 assert.ok(read('modern/src/screens/original-application.tsx').includes('<LazyPwaRegister/>'))
 for(const language of ['nl','fr','en','de']){
  const manifest=JSON.parse(read('modern/public/manifest-'+language+'.webmanifest'))
  assert.equal(manifest.short_name,'UP TILL DAWN');assert.equal(manifest.icons[0].src,'/up-till-dawn-mark.webp')
 }
})

test('original client shell and open AI state survive ordinary refresh; identities remain isolated',()=>{
 const app=read('modern/src/screens/original-application.tsx'),navigation=read('modern/src/compat/navigation.ts')
 assert.match(app,/<Boundary key=\{identityKey\} revision=\{requestKey\}/)
 assert.match(app,/<OriginalRequest key=\{identityKey\} revision=\{requestKey\}/)
 assert.match(navigation,/useLayoutEffect\(\(\)=>\{current.current=navigate\}/)
 assert.match(navigation,/useMemo\(\(\)=>new URLSearchParams\(search\),\[search\]\)/)
 assert.ok(read('modern/tests/browser-auth-qa.mjs').includes('ORIGINAL_CLIENT_STATE_LOST_ON_REFRESH'))
})
