import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const auth=readFileSync('lib/actions/auth.ts','utf8')
const chat=readFileSync('app/(app)/chat/page.tsx','utf8')
const dashboard=readFileSync('components/administration/administration-overview-dashboard.tsx','utf8')
const browser=readFileSync('scripts/e2e-seven-main-bots.mjs','utf8')

test('Supabase 5xx and 429 failures are not reported as wrong credentials or role denial',()=>{
 assert.match(auth,/status === 429 \|\| authCode\.includes\('rate_limit'\)/)
 assert.match(auth,/code: 'auth_rate_limited'/)
 assert.match(auth,/status >= 500/)
 assert.match(auth,/code: 'auth_temporarily_unavailable'/)
 assert.ok(auth.indexOf("code: 'auth_temporarily_unavailable'") < auth.indexOf("code: 'invalid_credentials_or_role'"))
 assert.match(auth,/await notifySecurity\('failure'/)
})
test('QA retriable Auth failures remain narrowly bounded, with hard role-denial failures',()=>{
 assert.match(browser,/for\(let attempt=1;attempt<=2&&!signedIn;attempt\+\+\)/)
 assert.match(browser,/temporaryAuthFailure=\['unexpected_action_failure','auth_temporarily_unavailable','auth_rate_limited'\]\.includes\(code\)/)
 assert.match(browser,/if\(!temporaryAuthFailure\|\|attempt===2\)/)
 assert.match(browser,/assert\.ok\(signedIn/)
 assert.match(browser,/Supabase SSR authentication cookie/)
})
test('Chat terminates all six read-only Supabase queries on the same deadline',()=>{
 assert.match(chat,/const chatSignal=AbortSignal\.timeout\(10_000\)/)
 assert.equal((chat.match(/\.abortSignal\(chatSignal\)/g)||[]).length,6)
 assert.match(chat,/boundedQueries\(\[/)
 assert.match(chat,/signedDirectoryPhotoUrls/)
 assert.match(chat,/const readable=\(channels\|\|\[\]\)/)
})
test('Administration remains usable and truthful when status reads hang',()=>{
 assert.match(dashboard,/const stop=AbortSignal\.timeout\(16_000\)/)
 assert.match(dashboard,/Promise\.race\(\[loadOverviewData\(db,currentUserId\)\.catch\(\(\)=>null\),hardStop\]\)/)
 assert.match(dashboard,/else setLoadFailed\(true\)/)
 assert.match(dashboard,/data-administration-overview-loading="true"/)
 assert.match(dashboard,/loadFailed\?t\.error/)
 assert.match(dashboard,/data-administration-priority=\{item\.id\}/)
})
