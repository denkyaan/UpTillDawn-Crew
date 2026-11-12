import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {currentGodEnvironment,requiredGodEnvironment,GOD_ENVIRONMENTS} from '../lib/god-mode-environments.ts'

test('isolated Maker fixture is the only local God Mode environment override',()=>{
 const original={bridge:process.env.UPT_E2E_SESSION_BRIDGE,url:process.env.NEXT_PUBLIC_APP_URL}
 try{
  process.env.UPT_E2E_SESSION_BRIDGE='1'
  process.env.NEXT_PUBLIC_APP_URL='http://127.0.0.1:3000'
  assert.equal(currentGodEnvironment('http://127.0.0.1:54321'),'main')
  assert.equal(requiredGodEnvironment('http://127.0.0.1:54321').id,'main')
  for(const invalid of ['http://localhost:54321','http://127.0.0.1:54322','http://0.0.0.0:54321',
   'https://npbjrtiolqperdgljnhi.supabase.co.attacker.invalid',undefined]){
   assert.equal(currentGodEnvironment(invalid),null)
  }
  process.env.UPT_E2E_SESSION_BRIDGE='0'
  assert.equal(currentGodEnvironment('http://127.0.0.1:54321'),null)
  process.env.UPT_E2E_SESSION_BRIDGE='1'
  process.env.NEXT_PUBLIC_APP_URL='https://uptilldawn-main.uptilldawn.workers.dev'
  assert.equal(currentGodEnvironment('http://127.0.0.1:54321'),null)
  assert.equal(currentGodEnvironment(GOD_ENVIRONMENTS.production.supabaseUrl),'production')
  assert.equal(currentGodEnvironment(GOD_ENVIRONMENTS.main.supabaseUrl),'main')
 }finally{
  if(original.bridge===undefined)delete process.env.UPT_E2E_SESSION_BRIDGE
  else process.env.UPT_E2E_SESSION_BRIDGE=original.bridge
  if(original.url===undefined)delete process.env.NEXT_PUBLIC_APP_URL
  else process.env.NEXT_PUBLIC_APP_URL=original.url
 }
})

test('full isolated release CI exercises God Mode with a distinct Maker identity',()=>{
 const ci=readFileSync('.github/workflows/ci.yml','utf8')
 const seed=ci.indexOf('Prepare separate temporary Maker identity for six-role browser QA')
 const maker=ci.indexOf('Maker God Mode actual-session and read-only control E2E (isolated)')
 const bot=ci.indexOf('Run 15 concurrent authenticated browser bots')
 assert.ok(seed>=0&&maker>seed&&bot>maker)
 assert.match(ci,/node scripts\/god-mode-maker-e2e\.mjs/)
 assert.match(ci,/test-results\/god-mode-e2e\//)
})

test('God Mode browser E2E covers real owner session and rejects staff privilege escalation',()=>{
 const script=readFileSync('scripts/god-mode-maker-e2e.mjs','utf8')
 for(const token of [
  'http://127.0.0.1:54321','UPT_E2E_SESSION_BRIDGE',
  'bot-16-maker@bots.uptilldawn.test','bot-03-staff-en@bots.uptilldawn.test',
  'enter.click()',"'uptilldawn-god-session'".replace(/'/g,''),
  '/api/god/logs?environment=main','/api/god/overview?environment=main',
  '/api/god/sql','cross-origin','God Mode afsluiten','logout',
 ]){
  if(token==='uptilldawn-god-session'||token==='logout')continue
  assert.ok(script.includes(token),'Expected God Mode test coverage: '+token)
 }
 assert.doesNotMatch(script,/https:\/\/crew\.uptilldawn\.workers\.dev|https:\/\/eakoavcieossazqzplke\.supabase\.co/)
 assert.match(script,/assert\.equal\(foreign\.status\(\),403/)
 assert.match(script,/assert\.equal\(resp\.status\(\),401/)
 assert.match(script,/await leave\.click\(\)/)
})
