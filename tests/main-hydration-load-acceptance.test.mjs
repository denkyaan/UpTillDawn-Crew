import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=path=>readFileSync(path,'utf8')
test('SSR route content stays visible while optional browser shell hydrates',()=>{
 const shell=read('components/layout/lazy-app-layout.tsx')
 assert.match(shell,/createContext<ReactNode>\(null\)/)
 assert.match(shell,/useContext\(ShellChildrenContext\)/)
 assert.match(shell,/loading:ShellLoading/)
 assert.match(shell,/\{content\}/)
 assert.match(shell,/<ShellChildrenContext\.Provider value=\{children\}>/)
 assert.match(shell,/ssr:false/)
 assert.match(read('app/(app)/layout.tsx'),/await getCurrentUser\(\)/)
})
test('Main Staff Tasks acceptance requires hydrated client, not skeleton',()=>{
 const tasks=read('components/crew/staff-tasks-client.tsx')
 const browser=read('scripts/e2e-seven-main-bots.mjs')
 assert.match(tasks,/data-staff-tasks-hydrated="true"/)
 assert.match(browser,/if\(path==='\/tasks'\)await page\.locator\('\[data-staff-tasks-hydrated="true"\]'\)/)
 assert.match(browser,/waitFor\(\{state:'visible',timeout:30000\}\)/)
})
test('30-user acceptance keeps all 30 sessions and RLS checks with bounded 14s reads',()=>{
 const source=read('scripts/main-30-distinct-staff.mjs')
 assert.match(source,/const COUNT=30/)
 assert.match(source,/const pages=await pool\(sessions,3,'browser-route'/)
 assert.match(source,/await pool\(sessions,3,'real-routes-and-rls'/)
 assert.match(source,/transport_or_timeout/)
 assert.doesNotMatch(source,/AbortSignal\.timeout\(8000\)/)
 assert.equal((source.match(/AbortSignal\.timeout\(14000\)/g)||[]).length,7)
 assert.match(source,/report\.http5xx===0&&errors\.length===0&&report\.cleanupVerified/)
})
