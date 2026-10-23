import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const config=JSON.parse(readFileSync('wrangler.staging.jsonc','utf8'))
const ci=readFileSync('.github/workflows/staging-preview.yml','utf8')
test('staging worker has independent Cloudflare identity and does not alias production',()=>{
 assert.equal(config.name,'uptilldawn-crew-staging')
 assert.notEqual(config.name,'uptilldawn-crew')
 assert.notEqual(config.name,'crew')
 assert.equal(config.workers_dev,true)
 assert.equal(config.assets.binding,'ASSETS')
 assert.equal(config.ai.binding,'AI')
 assert.doesNotMatch(JSON.stringify(config),/eakoavcieossazqzplke/)
})
test('staging workflow rejects production database and deploys only separate config',()=>{
 assert.match(ci,/UPT_TEST_SUPABASE_URL/)
 assert.match(ci,/UPT_TEST_SUPABASE_ANON_KEY/)
 assert.match(ci,/Refusing to connect staging to the production database/)
 assert.match(ci,/https:\/\/eakoavcieossazqzplke\.supabase\.co/)
 assert.match(ci,/wrangler deploy --config wrangler\.staging\.jsonc/)
 assert.doesNotMatch(ci,/npm run deploy:cloudflare/)
 assert.doesNotMatch(ci,/wrangler\.alias\.jsonc/)
 assert.doesNotMatch(ci,/git merge|git push origin main|merge_pull_request/)
})
