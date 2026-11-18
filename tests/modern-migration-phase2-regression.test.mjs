import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=path=>readFileSync(path,'utf8')
test('candidate PWA static assets are isolated from legacy Next production worker',()=>{
 const vite=read('modern/vite.config.ts')
 const html=read('modern/index.html')
 const serviceWorker=read('modern/public/sw.js')
 assert.match(vite,/publicDir:"public"/)
 assert.doesNotMatch(vite,/\.\.\/public/)
 assert.match(html,/rel="manifest" href="\/manifest\.webmanifest"/)
 assert.match(serviceWorker,/url\.pathname\.startsWith\("\/api\/"\)/)
 assert.doesNotMatch(serviceWorker,/caches\.match\(.*auth/)
})
test('four-language selector is a single shared store for all migrated screens',()=>{
 const main=read('modern/src/main.tsx')
 const hook=read('modern/src/lib/use-locale.ts')
 assert.match(main,/import \{useLocale,setLocale\} from "\.\/lib\/use-locale"/)
 for(const screen of ['tasks','chats','finance','events']){
  assert.match(read('modern/src/screens/'+screen+'.tsx'),/useLocale\(\)/)
 }
 assert.match(hook,/useSyncExternalStore\(subscribe,read/)
 assert.match(hook,/localStorage\.setItem/)
 assert.match(hook,/document\.documentElement\.lang=locale/)
 assert.match(read('modern/src/shared/i18n.ts'),/\["nl","fr","en","de"\]/)
})
test('migration availability writes reuse the existing audited RPC and default to OFF',()=>{
 const db=read('modern/src/lib/availability.ts')
 const events=read('modern/src/screens/events.tsx')
 assert.match(db,/VITE_MIGRATION_ALLOW_WRITES!=="true"/)
 assert.match(db,/rpc\("upt_current_session_context"\)/)
 assert.match(db,/identity\.id!==session\.user\.id/)
 assert.match(db,/rpc\("upt_set_event_availability_with_reason"/)
 assert.doesNotMatch(db,/\.from\("event_availability"\)\.upsert/)
 assert.match(events,/availabilityVerified=\{availability!==null&&!availabilityError\}/)
 assert.match(events,/VITE_MIGRATION_ALLOW_WRITES==="true"/)
 assert.match(read('modern/.env.example'),/VITE_MIGRATION_ALLOW_WRITES=false/)
})
test('static bundle budget is an enforced candidate-only CI gate',()=>{
 const scripts=read('modern/scripts/bundle-budget.mjs')
 const ci=read('.github/workflows/fast-change-validation.yml')
 const pkg=JSON.parse(read('modern/package.json'))
 assert.match(scripts,/maxInitialGzip=128\*1024/)
 assert.match(scripts,/process\.argv|initialGzip>maxInitialGzip/)
 assert.equal(pkg.scripts.budget,'node scripts/bundle-budget.mjs')
 assert.match(ci,/npm --prefix modern run build\s+npm --prefix modern run budget/)
 assert.match(ci,/github\.event_name == 'pull_request' && startsWith\(github\.head_ref, 'migration\/'\)/)
})
