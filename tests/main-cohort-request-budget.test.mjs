import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const offline=readFileSync('components/crew/global-offline-content-sync.tsx','utf8')
const shell=readFileSync('components/layout/app-layout.tsx','utf8')
const promotionNav=readFileSync('components/promotion/promotion-bottom-nav.tsx','utf8')

test('Main: the full offline snapshot still includes all 16 RLS-protected reads, but only two run simultaneously',()=>{
 const start=offline.indexOf('const snapshotSignal=AbortSignal.timeout(12_000)')
 const end=offline.indexOf('],2)',start)
 assert.ok(start>=0&&end>start)
 const snapshot=offline.slice(start,end)
 assert.equal((snapshot.match(/s\.from\('/g)||[]).length,16)
 assert.equal((snapshot.match(/\.abortSignal\(snapshotSignal\)/g)||[]).length,16)
 assert.match(offline,/snapshotResults\.some\(result=>Boolean\(result\.error\)\)\)return/)
 assert.match(offline,/acquireLease\(\)/)
 assert.match(offline,/releaseLease\(\)/)
 assert.match(offline,/readLastSuccess\(\)/)
})

test('Main: low-priority offline snapshots are cohort-jittered away from foreground page loads',()=>{
 assert.match(offline,/const staggerMs=\[\.\.\.userId\][\s\S]*?%48_000/)
 assert.match(offline,/\},10_000\+staggerMs\)/)
 assert.match(offline,/syncOfflineContent\(\{force:true\}\)/)
 assert.match(offline,/setInterval\(\(\)=>\{if\(document\.visibilityState==='visible'\)void syncOfflineContent\(\)\.catch\(\(\)=>\{\}\)\},15\*60\*1000\)/)
})

test('Main: unread badges remain interactive, while start and periodic refresh are distributed by account',()=>{
 assert.match(shell,/const initial=window\.setTimeout\(\(\)=>safeRefresh\(\),400\+seed%6500\)/)
 assert.match(shell,/pathname\.startsWith\("\/portals\/"\)\?45_000\+seed%8_000:30_000\+seed%8_000/)
 assert.match(shell,/const focus=\(\)=>safeRefresh\(\)/)
 assert.match(shell,/const chatRead=\(\)=>safeRefresh\(true\)/)
 assert.match(shell,/refreshInFlight\.current=true/)
 assert.match(shell,/finally\{refreshInFlight\.current=false\}/)
})

test('Main: promotion navbar still navigates correctly without speculative server requests',()=>{
 assert.match(promotionNav,/<Link prefetch=\{false\} key=\{tab\.href\} href=\{tab\.href\}/)
 assert.match(promotionNav,/aria-current=\{active\?"page":undefined\}/)
})
