import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const dashboard=readFileSync('components/administration/administration-overview-dashboard.tsx','utf8')
const extra=readFileSync('components/administration/administration-subtab-status.tsx','utf8')
const browser=readFileSync('scripts/e2e-seven-main-bots.mjs','utf8')

test('primary Administration overview is a separate streamed, usable work pulse',()=>{
 assert.match(dashboard,/import \{Suspense\} from "react"/)
 assert.match(dashboard,/<main data-administration-overview-ready="true"/)
 assert.match(dashboard,/<Suspense fallback=\{<section/)
 assert.match(dashboard,/<AdministrationSubtabStatus locale=\{locale\}\/>/)
 assert.match(dashboard,/data-administration-status-loading="true"/)
 assert.match(dashboard,/data-administration-priority=\{item\.id\}/)
})

test('20 secondary subtab queries have an 8s AbortSignal and an independent 10s hard stop',()=>{
 assert.match(extra,/const statusSignal=AbortSignal\.timeout\(8_000\)/)
 assert.match(extra,/new Promise<null>\(resolve=>\{statusTimer=setTimeout\(\(\)=>resolve\(null\),10_000\)\}\)/)
 assert.match(extra,/Promise\.race\(\[/)
 assert.match(extra,/Promise\.all\(\[/)
 assert.equal((extra.match(/\.abortSignal\(statusSignal\)/g)||[]).length,20)
 assert.match(extra,/if\(!statuses\)return <section/)
 assert.match(extra,/data-administration-status-unavailable="true"/)
 assert.match(extra,/clearTimeout\(statusTimer\)/)
})

test('secondary status timeout never renders fabricated zero/connected status',()=>{
 assert.match(extra,/if\(result\.error\|\|result\.count===null\)return \{value:"—",detail:unavailable,error:true\}/)
 assert.match(extra,/if\(!statuses\)return <section[^\n]*data-administration-status-unavailable=/)
 assert.match(extra,/<p className="mt-1">\{t\.unavailable\}<\/p>/)
})

test('role E2E checks real visible overview and seven actions, not a hidden React streaming template',()=>{
 assert.match(browser,/data-administration-overview-ready="true"\] h1/)
 assert.match(browser,/actions\.first\(\)\.waitFor\(\{state:'visible'/)
 assert.match(browser,/assert\.equal\(await actions\.count\(\),7/)
})
