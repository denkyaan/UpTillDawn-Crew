import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {getTrainingOperations} from '../lib/training-exercise-catalog.ts'
const read=path=>readFileSync(path,'utf8')

test('chat sandbox is selected exclusively in tour mode and never replaces real chat',()=>{
 const route=read('app/(app)/chat/page.tsx')
 assert.match(route,/if\(params\.tour==='1'\)return <SandboxChatTraining role=\{current\.role\}\/>/)
 assert.match(route,/return <main[\s\S]*<ChatClient channels=/)
})

test('chat demo supports 22 shared exercises and six admin-only exercises for each role',()=>{
 const source=read('components/training/sandbox-chat-training.tsx')
 const shared=getTrainingOperations('employee','chat').filter(x=>x.id.startsWith('chat:shared:'))
 assert.equal(shared.length,22)
 const admin=getTrainingOperations('admin','chat')
 assert.equal(admin.length,28)
 for(const role of ['employee','responsible_lead','admin']){
  assert.equal(getTrainingOperations(role,'chat').length,role==='admin'?28:22)
 }
 assert.match(source,/data-training-practical-op=\{current\.id\}/)
 assert.match(source,/detail:\{role:normalized,chapter:"chat",id:current\.id,kind:current\.kind,value\}/)
 assert.match(source,/current\.kind==="message"&&value\.trim\(\)\.length<5/)
 assert.match(source,/sessionStorage\.setItem\(key,JSON\.stringify\(next\)\)/)
 assert.doesNotMatch(source,/supabase\.|createClient\(|fetch\(/)
})

test('chat simulation retains private messages after removing conversation; no false antivirus claims',()=>{
 const source=read('components/training/sandbox-chat-training.tsx')
 assert.match(source,/if\(i===13\)\{next\.privateVisible=false;next\.channel="event";record\(next,"confirmed"\);return\}/)
 assert.match(source,/const privateCount=state\.messages\.filter\(m=>m\.channel==="private"\)\.length/)
 assert.match(source,/const target:Channel=i===5\?"private":"event"/)
 assert.match(source,/i===8&&!draft\.includes\("@Lina"\)/)
 assert.match(source,/simulated?\s+background|scan workflow reviewed|simulatie van achtergrondcontrole/i)
 assert.match(source,/data-demo-chat-retained=\{privateCount\}/)
})

test('browser bots must fill and click real contextual chat steps and check persistent evidence',()=>{
 const bot=read('scripts/15-bot-browser-test.mjs')
 assert.match(bot,/const chatReal=chapter==='chat'&&operationId\.startsWith\('chat:'\)/)
 assert.match(bot,/const requiredReal=chatReal\b/,'chat controls must be mandatory')
 assert.match(bot,/\|\|peopleReal\b/,'crew controls must be mandatory')
 assert.match(bot,/\|\|systemReal\b/,'system controls must be mandatory')
 assert.match(bot,/\|\|helpReal\b/,'Help controls must be mandatory')
 assert.match(bot,/\|\|lifecycleReal\b/,'Driver and timesheet controls must be mandatory')
 assert.match(bot,/data-demo-chat-search/)
 assert.match(bot,/data-demo-chat-choice/)
 assert.match(bot,/data-demo-chat-composer/)
 assert.match(bot,/data-demo-chat-attachment/)
 assert.match(bot,/if\(chapter==='chat'\)/)
 assert.match(bot,/simulated\.retainedPrivate<1/)
 assert.match(bot,/simulated\.attachment/)
})

test('chat search, pin review, unpin, older messages and moderation persist domain state',()=>{
 const source=read('components/training/sandbox-chat-training.tsx')
 const bot=read('scripts/15-bot-browser-test.mjs')
 for(const fragment of ['data-demo-chat-search-results','data-demo-chat-pinned','data-demo-chat-older-loaded','next.messageMatches=','next.pinnedMessageIds.push','next.pinnedMessageIds=next.pinnedMessageIds.filter','next.moderatedMessageIds.push','next.olderLoaded=true'])assert.ok(source.includes(fragment),'missing chat control '+fragment)
 assert.match(bot,/operationId==='chat:shared:19'/)
 assert.match(bot,/simulated\.pinAudit\.join\(','\)!=='pin,unpin'/)
 assert.match(bot,/simulated\.moderated!==1/)
 assert.doesNotMatch(source,/supabase\.from\(|createClient\(|fetch\(/)
})
