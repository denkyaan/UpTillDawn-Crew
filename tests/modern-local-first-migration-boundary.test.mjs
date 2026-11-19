import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const read=path=>readFileSync(path,'utf8')

test('migration candidate is independent and cannot auto-deploy or replace production',()=>{
 const main=JSON.parse(read('package.json'))
 const modern=JSON.parse(read('modern/package.json'))
 const candidate=JSON.parse(read('modern/wrangler.jsonc'))
 assert.ok(main.dependencies.next,'Existing production runtime must remain intact')
 assert.equal(modern.scripts["build"].includes('vite build'),true)
 assert.ok(modern.dependencies.hono)
 assert.ok(modern.dependencies['react-router-dom'])
 assert.ok(!modern.dependencies.next)
 assert.ok(!modern.dependencies['@opennextjs/cloudflare'])
 assert.equal(candidate.workers_dev,false)
 assert.equal(candidate.preview_urls,false)
 assert.equal(candidate.assets.not_found_handling,'single-page-application')
 assert.deepEqual(candidate.assets.run_worker_first,['/api/*'])
 const files=['.github/workflows/ci.yml','.github/workflows/fast-change-validation.yml','.github/workflows/deploy-main.yml','.github/workflows/deploy-cloudflare.yml','.github/workflows/cleanup-actions-history.yml']
 assert.equal(files.length,5)
 for(const name of files)assert.doesNotMatch(read(name),/modern\/wrangler|uptilldawn-modern-candidate/)
 assert.equal(main.scripts["deploy:cloudflare"],"opennextjs-cloudflare deploy")
})

test('ordinary modern navigation is static; Hono API does not use service keys or trust client role labels',()=>{
 const worker=read('modern/src/api/worker.ts')
 assert.match(worker,/new Hono/)
 assert.match(worker,/auth\.getClaims\(match\[1\]\)/)
 assert.match(worker,/rpc\("upt_current_session_context"\)/)
 assert.match(worker,/parseIdentity\(Array\.isArray\(rows\)/)
 assert.match(worker,/isActive\(identity\)/)
 assert.match(worker,/app\.get\("\/api\/v1\/session"/)
 assert.match(worker,/app\.notFound\(/)
 assert.doesNotMatch(worker,/service_role|SERVICE_ROLE|SUPABASE_SECRET_KEY|jwt\.decode/)
})

test('browser session is verified by RLS, never by local JWT metadata or admin query parameter',()=>{
 const session=read('modern/src/lib/session.tsx')
 const identities=read('modern/src/shared/identity.ts')
 assert.match(session,/rpc\("upt_current_session_context"\)/)
 assert.match(session,/rpc\("upt_my_portal_assignments"\)/)
 assert.match(session,/identity\.id!==session\.user\.id/)
 assert.match(session,/isActive\(identity\)/)
 assert.match(session,/purgeSnapshotUser\(uid\)/)
 assert.match(identities,/account_blocked/)
 assert.match(identities,/a\.revoked_at===null/)
 assert.doesNotMatch(session,/auth\.getSession\(\)[\s\S]*?setState\(\{status:"ready",identity:session\.user/)
})

test('RLS data access and local-only cache are bounded and secure',()=>{
 const queries=read('modern/src/lib/queries.ts')
 const cache=read('modern/src/lib/local-cache.ts')
 const pwa=read('modern/public/sw.js')
 assert.match(queries,/\.limit\(80\)\.abortSignal\(signal\)/)
 assert.match(queries,/\.limit\(100\)\.abortSignal\(signal\)/)
 assert.match(queries,/\.rpc\("upt_administration_finance_summary"\)/)
 assert.match(queries,/if\(error\|\|!data/)
 assert.match(cache,/uid\+":"\+kind/)
 assert.match(cache,/purgeSnapshotUser/)
 assert.match(cache,/type CacheKey="events"\|"tasks"\|"chat-list"/)
 assert.doesNotMatch(cache,/type CacheKey[^\n]*(finance|bank|auth|token)/i)
 assert.match(pwa,/url\.pathname\.startsWith\("\/api\/"\)/)
 assert.doesNotMatch(pwa,/cache\.put\(.*(?:authorization|postgrest|auth\/v1)/i)
})

test('partial migration explicitly blocks fake completion and preserves all unported roles',()=>{
 const main=read('modern/src/main.tsx')
 const readme=read('modern/README.md')
 assert.match(main,/path="\/god\/\*" element=\{<Missing\/>\}/)
 assert.match(main,/path="\*" element=\{<Missing\/>\}/)
 assert.match(main,/className="notice" role="note"/)
 assert.match(readme,/NOT PRODUCTION-READY/)
 assert.match(readme,/all seven role bots/)
 assert.match(readme,/30\+ simultaneous sessions/)
 assert.match(read('modern/scripts/inventory.mjs'),/migrationReady:false/)
 assert.match(read('modern/scripts/inventory.mjs'),/process\.exitCode=1/)
})
