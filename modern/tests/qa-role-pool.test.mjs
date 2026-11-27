import test from 'node:test'
import assert from 'node:assert/strict'
import {runRolePool,verifyExactCoverage} from './qa-role-pool.mjs'
test('role pool bounds concurrency, finishes all independent work and reports failures',async()=>{
 const items=Array.from({length:8},(_,i)=>i)
 let active=0,peak=0
 const calls=[],completed=[]
 const result=await runRolePool(items,3,async n=>{
  active++;peak=Math.max(peak,active);calls.push(n)
  try{await new Promise(r=>setTimeout(r,5));if(n===2)throw Error('role failure')}
  finally{active--}
 },({index})=>completed.push(index))
 assert.equal(peak,3);assert.equal(result.peak,3);assert.equal(active,0)
 assert.deepEqual(calls.toSorted((a,b)=>a-b),items)
 assert.deepEqual(completed.toSorted((a,b)=>a-b),items)
 assert.equal(result.errors.length,1);assert.equal(result.errors[0].index,2)
 await assert.rejects(runRolePool(items,4,async()=>{}),/INVALID_ROLE_POOL/)
})
test('exact coverage rejects missing, duplicate and unknown cases even when counts agree',()=>{
 const expected=['a','b','c']
 assert.equal(verifyExactCoverage(expected,['c','b','a']).complete,true)
 for(const actual of [['a','a','c'],['a','b','x'],['a','b'],['a','b','c','c']])assert.equal(verifyExactCoverage(expected,actual).complete,false)
 assert.equal(verifyExactCoverage(['a','a'],['a','a']).complete,false)
})
