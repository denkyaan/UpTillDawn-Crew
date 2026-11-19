import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const config=JSON.parse(readFileSync(new URL("../wrangler.main-qa.jsonc",import.meta.url),"utf8"))
test("Main modern Worker has static-first Free-tier routing and no business writes",()=>{
 assert.equal(config.name,"uptilldawn-modern-main")
 assert.equal(config.workers_dev,true)
 assert.equal(config.vars.SUPABASE_URL,"https://npbjrtiolqperdgljnhi.supabase.co")
 assert.ok(config.vars.SUPABASE_ANON_KEY.startsWith("sb_publishable_"))
 assert.equal(config.vars.UPT_MIGRATION_OAUTH_ENABLED,"false")
 assert.equal(config.vars.UPT_MIGRATION_SCANNING_ENABLED,"false")
 assert.deepEqual(config.assets.run_worker_first,["/api/*","/auth/callback"])
 assert.equal(config.assets.not_found_handling,"single-page-application")
 const code=readFileSync(new URL("../scripts/main-qa-live-smoke.mjs",import.meta.url),"utf8")
 assert.ok(code.includes(origin))
 assert.ok(code.includes('noTickets.status===401'))
 assert.ok(code.includes('noOauth.status===401'))
})
