import test from 'node:test'
import assert from 'node:assert/strict'
import {authCallbackOrigin} from '../lib/auth-callback-origin.ts'
const main='https://uptilldawn-main.uptilldawn.workers.dev'
const candidate='https://uptilldawn-modern-main.uptilldawn.workers.dev'
const qa='https://npbjrtiolqperdgljnhi.supabase.co'
test('email callbacks stay on the configured host except the exact Main QA candidate',()=>{
 assert.equal(authCallbackOrigin(main,qa,null),main)
 assert.equal(authCallbackOrigin(main,qa,candidate),candidate)
 assert.equal(authCallbackOrigin(main,qa,'https://attacker.invalid'),main)
 assert.equal(authCallbackOrigin(main,qa,candidate+'/extra'),main)
 assert.equal(authCallbackOrigin(main,'https://production.invalid',candidate),main)
 assert.equal(authCallbackOrigin('https://crew.uptilldawn.workers.dev',qa,candidate),'https://crew.uptilldawn.workers.dev')
 assert.equal(authCallbackOrigin(undefined,qa,candidate),null)
 assert.equal(authCallbackOrigin('javascript:alert(1)',qa,candidate),null)
})
