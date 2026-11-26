import test from 'node:test'
import assert from 'node:assert/strict'
import {withDeadline} from './qa-browser-deadline.mjs'
test('deadline rejects hanging operations, preserves valid results and propagates real errors',async()=>{
 assert.equal(await withDeadline('SUCCESS',async()=>42,100),42)
 await assert.rejects(withDeadline('HANG',()=>new Promise(()=>{}),20),/DEADLINE_HANG/)
 await assert.rejects(withDeadline('FAIL',async()=>{throw Error('original error')},100),/original error/)
 await assert.rejects(withDeadline('INVALID',async()=>42,0),/INVALID_DEADLINE/)
})
