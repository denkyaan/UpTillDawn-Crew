import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=path=>readFileSync(path,'utf8')

test('Main OpenNext does not intercept dynamic authenticated SSR with a static cache',()=>{
 const source=read('open-next.config.ts')
 assert.match(source,/incrementalCache:\s*staticAssetsIncrementalCache/)
 assert.match(source,/enableCacheInterception:\s*false/)
 assert.doesNotMatch(source,/cacheEverything:\s*true|cacheControl:\s*public/)
})
test('Shared app shell and event action links never prefetch authenticated RSC destinations',()=>{
 for(const path of ['components/layout/app-layout.tsx','app/(app)/events/manager-page.tsx']){
  const source=read(path)
  assert.ok((source.match(/<Link\s/g)||[]).length>0,path+' has no Next.js links')
  assert.equal((source.match(/<Link\s+prefetch=\{false\}/g)||[]).length,
   (source.match(/<Link\s/g)||[]).length,path+' introduced speculative protected navigation')
 }
})
test('Distinct-user load test still reports SSR failures but continues independent RLS/Reatime checks',()=>{
 const source=read('scripts/main-30-distinct-staff.mjs')
 assert.match(source,/allowPartial=false/)
 assert.match(source,/allowPartial:true/)
 assert.match(source,/MAIN_30_DISTINCT_BROWSERS success=/)
 assert.match(source,/const pages=await pool\(sessions,3,'browser-route'/)
 assert.match(source,/await pool\(sessions,3,'real-routes-and-rls'/)
 assert.match(source,/const channels=await pool\(sessions,[1-5],'realtime-subscription'/)
 assert.match(source,/report\.browserReady===COUNT/)
 assert.match(source,/report\.http5xx===0&&errors\.length===0&&report\.cleanupVerified/)
 assert.match(source,/const path=\['\/events','\/tasks','\/chat'\]/)
})