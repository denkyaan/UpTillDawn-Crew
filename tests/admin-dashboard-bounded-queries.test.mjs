import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {boundedQueries} from '../lib/administration/bounded-queries.ts'
const source=readFileSync('app/(app)/admin/page.tsx','utf8')

test('Admin thirteen concurrent reads have one deadline and a four-request cap',()=>{
 assert.match(source,/const adminOverviewSignal=AbortSignal\.timeout\(15_000\)/)
 assert.match(source,/\[events,sessions,pendingIns,pendingOuts,incidents,assignments,shifts,profiles,workplaces,syncIssues,responsibleAssignments,pendingProfiles,operationalAlerts\]=await boundedQueries\(\[/)
 const batch=source.slice(source.indexOf(']=await boundedQueries(['),source.indexOf('],4)'))
 assert.equal((batch.match(/\.abortSignal\(adminOverviewSignal\)/g)||[]).length,13)
 assert.match(source,/\],4\)/)
 assert.match(source,/const \[approvedChecks,historicalEventCheck,sessionBreaks\]=await Promise\.all\(\[/)
})
test('Bounded lazy reads preserve ordered values and failure propagation',async()=>{
 let active=0,peak=0
 const queries=Array.from({length:13},(_,i)=>({then(resolve){
  active++;peak=Math.max(peak,active)
  setTimeout(()=>{active--;resolve({index:i})},3)
 }}))
 const rows=await boundedQueries(queries,4)
 assert.equal(peak,4)
 assert.equal(active,0)
 assert.deepEqual(rows.map(r=>r.index),Array.from({length:13},(_,i)=>i))
 await assert.rejects(()=>boundedQueries([Promise.reject(new Error('read denied'))],2),/read denied/)
 await assert.rejects(()=>boundedQueries(queries,0),/positive integer/)
})
test('Admin never shows a fabricated zero or empty incident state on failed sources',()=>{
 assert.ok(source.includes('value===null?"—":value'))
 for(const label of ['Actieve evenementen','Aan het werk','Open help oproepen','Nieuwe accountgoedkeuringen','Goedgekeurd personeel']){
  const row=source.split('\n').find(line=>line.includes('label="'+label+'"'))
  assert.ok(row&&row.includes('.error?null:'),label)
 }
 assert.match(source,/incidents\.error\?<p role="status"/)
 assert.match(source,/sessionBreaks\.error\?<p role="status"/)
})
