import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {readStrictJson} from '../lib/strict-json-body.ts'

const translation=readFileSync('app/api/translate-chat/route.ts','utf8')
const pushConfig=readFileSync('app/api/push/config/route.ts','utf8')
const pushSubscription=readFileSync('app/api/push/subscription/route.ts','utf8')

test('AI translation requires verified approved non-blocked session before reading body or invoking AI',()=>{
  assert.match(translation,/await getCurrentUser\(\)/)
  assert.doesNotMatch(translation,/auth\.getUser\(\)/)
  assert.ok(translation.indexOf('await getCurrentUser()')<translation.indexOf('readStrictJson(request,8192)'))
  assert.ok(translation.indexOf('readStrictJson(request,8192)')<translation.indexOf('ai.run('))
  assert.match(translation,/status:error instanceof Error&&error\.message==='too_large'\?413:400/)
})

test('push endpoints gate both writes and public configuration behind verified active session',()=>{
  assert.match(pushConfig,/await getCurrentUser\(\)/)
  assert.doesNotMatch(pushConfig,/auth\.getUser\(\)/)
  assert.equal(pushSubscription.match(/await getCurrentUser\(\)/g)?.length,2)
  assert.equal(pushSubscription.match(/readStrictJson\(request,8192\)/g)?.length,2)
  assert.doesNotMatch(pushSubscription,/auth\.getUser\(\)/)
  assert.doesNotMatch(pushSubscription,/request\.json\(\)/)
  assert.ok(pushSubscription.indexOf('await getCurrentUser()')<pushSubscription.indexOf('readStrictJson(request,8192)'))
  assert.ok(pushSubscription.indexOf('readStrictJson(request,8192)')<pushSubscription.indexOf('upt_save_push_subscription'))
})

test('bounded JSON reader rejects declared or streamed oversized payloads and invalid JSON',async()=>{
  const url='https://uptilldawn.local/api/translate-chat'
  const json=(value,headers={})=>new Request(url,{method:'POST',headers:{'content-type':'application/json',...headers},body:value})
  assert.deepEqual(await readStrictJson(json('{"ok":true}'),8192),{ok:true})
  await assert.rejects(readStrictJson(json('{"ok":true}',{'content-length':'9000'}),8192),/too_large/)
  await assert.rejects(readStrictJson(json('x'.repeat(8193)),8192),/too_large/)
  await assert.rejects(readStrictJson(json('not json'),8192),/invalid_json/)
})
