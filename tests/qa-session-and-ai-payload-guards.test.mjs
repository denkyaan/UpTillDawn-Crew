import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {readStrictJson} from '../lib/strict-json-body.ts'

const read=path=>readFileSync(path,'utf8')
const qa=read('app/api/test-auth-session/route.ts')
const admin=read('app/api/admin-assistant/route.ts')
const administration=read('app/api/administration/assistant/route.ts')
const editor=read('app/api/edit-assistant/route.ts')

test('QA session endpoint is still disabled outside the isolated Main Worker and database',()=>{
 assert.match(qa,/process\.env\.UPT_E2E_SESSION_BRIDGE === '1'/)
 assert.match(qa,/NEXT_PUBLIC_SUPABASE_URL === 'https:\/\/npbjrtiolqperdgljnhi\.supabase\.co'/)
 assert.match(qa,/NEXT_PUBLIC_APP_URL === 'https:\/\/uptilldawn-main\.uptilldawn\.workers\.dev'/)
 assert.match(qa,/if \(!isIsolatedMainQA\)/)
 assert.ok(qa.indexOf('if (!isIsolatedMainQA)')<qa.indexOf('readStrictJson(request,16_384)'))
 assert.match(qa,/origin!==process\.env\.NEXT_PUBLIC_APP_URL/)
 assert.match(qa,/fetchSite&&fetchSite!=='same-origin'/)
 assert.ok(qa.indexOf("origin!==process.env.NEXT_PUBLIC_APP_URL")<qa.indexOf('readStrictJson(request,16_384)'))
 assert.match(qa,/\.strict\(\)\.safeParse\(raw\)/)
 assert.match(qa,/status:error instanceof Error&&error\.message==='too_large'\?413:400/)
 assert.doesNotMatch(qa,/await request\.json\(\)/)
})

test('resource-heavy AI APIs must parse bounded JSON before database fan-out or AI calls',()=>{
 for(const [source,limit] of [
  [admin,'32_768'],
  [administration,'256_000'],
  [editor,'128_000'],
 ]){
  assert.ok(source.includes(`readStrictJson(request,${limit})`))
  assert.doesNotMatch(source,/await request\.json\(\)/)
  assert.match(source,/status:error instanceof Error&&error\.message==='too_large'\?413:400/)
  assert.ok(source.indexOf(`readStrictJson(request,${limit})`)<source.indexOf('ai.run('))
 }
 assert.ok(admin.indexOf('readStrictJson(request,32_768)')<admin.indexOf("s.from('events')"))
 assert.ok(administration.indexOf('readStrictJson(request,256_000)')<administration.indexOf('Promise.all(['))
})

test('Admin and Administration AI maintain independent verified privilege requirements',()=>{
 assert.match(admin,/await getCurrentUser\(\)/)
 assert.match(admin,/upt_is_admin/)
 assert.match(admin,/if\(adminError\)return Response\.json/)
 assert.match(admin,/if\(!isAdmin\)return Response\.json/)
 assert.doesNotMatch(admin,/auth\.getUser\(\)/)
 assert.match(administration,/await getCurrentUser\(\)/)
 assert.match(administration,/canOpenPortal\("administration"/)
 assert.match(editor,/upt_god_session_valid/)
 assert.match(editor,/upt_current_is_owner/)
})

test('JSON reader accepts normal AI request and rejects oversized or invalid input',async()=>{
 const url='https://uptilldawn.local/api/admin-assistant'
 const request=(body,headers={})=>new Request(url,{
  method:'POST',headers:{'content-type':'application/json',...headers},body,
 })
 const valid=JSON.stringify({message:'Planning controleren',locale:'nl'})
 assert.deepEqual(await readStrictJson(request(valid),8_192),{message:'Planning controleren',locale:'nl'})
 await assert.rejects(readStrictJson(request(valid,{'content-length':'20000'}),8_192),/too_large/)
 await assert.rejects(readStrictJson(request('x'.repeat(8200)),8_192),/too_large/)
 await assert.rejects(readStrictJson(request('invalid JSON'),8_192),/invalid_json/)
})

test('payload caps still allow maximal valid escaped AI messages and history',async()=>{
 const url='https://uptilldawn.local/api/administration/assistant'
 const make=body=>new Request(url,{method:'POST',headers:{'content-type':'application/json'},body})
 const textWithEscapes='\u0000'.repeat(4000)
 const adminPayload=JSON.stringify({message:textWithEscapes,locale:'nl'})
 assert.ok(Buffer.byteLength(adminPayload)<32_768)
 const adminResult=await readStrictJson(make(adminPayload),32_768)
 assert.equal(adminResult.message.length,4000)
 const history=Array.from({length:8},()=>({role:'user',content:textWithEscapes}))
 const administrationPayload=JSON.stringify({message:textWithEscapes,locale:'nl',history})
 assert.ok(Buffer.byteLength(administrationPayload)<256_000)
 const parsed=await readStrictJson(make(administrationPayload),256_000)
 assert.equal(parsed.history.length,8)
 assert.equal(parsed.history[0].content.length,4000)
})
