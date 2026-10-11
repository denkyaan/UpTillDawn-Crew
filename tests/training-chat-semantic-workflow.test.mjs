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

test('chat demo supports 35 shared exercises and six admin-only exercises for each role',()=>{
 const source=read('components/training/sandbox-chat-training.tsx')
 const shared=getTrainingOperations('employee','chat').filter(x=>x.id.startsWith('chat:shared:'))
 assert.equal(shared.length,35)
 const admin=getTrainingOperations('admin','chat')
 assert.equal(admin.length,41)
 for(const role of ['employee','responsible_lead','admin']){
  assert.equal(getTrainingOperations(role,'chat').length,role==='admin'?41:35)
 }
 assert.match(source,/data-training-practical-op=\{current\.id\}/)
 assert.match(source,/detail:\{role:normalized,chapter:"chat",id:current\.id,kind:current\.kind,value\}/)
 assert.match(source,/current\.kind==="message"&&value\.trim\(\)\.length<5/)
 assert.match(source,/sessionStorage\.setItem\(key,JSON\.stringify\(next\)\)/)
 assert.doesNotMatch(source,/supabase\.|createClient\(|fetch\(/)
})

test('chat simulation deletes complete private conversation without individual message removal; no false antivirus claims',()=>{
 const source=read('components/training/sandbox-chat-training.tsx')
 assert.match(source,/next\.messages=next\.messages\.filter\(m=>m\.channel!=="private"\)/)
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
 assert.match(bot,/simulated\.retainedPrivate!==0/)
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

test('chat notification and example translation controls persist real training state transitions',()=>{
 const source=read('components/training/sandbox-chat-training.tsx')
 const bots=read('scripts/15-bot-browser-test.mjs')
 for(const x of ['data-demo-chat-notification-mode','data-demo-chat-notification=','data-demo-chat-auto-translate=','data-demo-chat-manual-translation=','next.notificationAudit.push(expected)','next.translationAudit.push("auto-on")','next.translationAudit.push("auto-off")','next.translationAudit.push("example-on")','next.translationAudit.push("example-off")'])assert.ok(source.includes(x),'missing '+x)
 assert.match(bots,/simulated\.notificationAudit\?\.join/)
 assert.match(bots,/simulated\.translationAudit\?\.join/)
 assert.match(source,/not a live translation service/)
 assert.doesNotMatch(source,/liveTranslateText\(|supabase\.from\(|createClient\(|fetch\(/)
})

test('advanced chat search needs sender, media, date range, keyword, result opening and reset',()=>{
 const source=read('components/training/sandbox-chat-training.tsx')
 const bot=read('scripts/15-bot-browser-test.mjs')
 for(const marker of ['data-demo-chat-search-filter','data-demo-chat-search-from','data-demo-chat-search-to','data-demo-chat-filtered-result','data-demo-chat-combined-results','data-demo-chat-selected-result','next.filteredMatches=next.messages.filter','next.filterAudit.push("clear")'])assert.ok(source.includes(marker),'missing search step '+marker)
 assert.match(source,/fromDate>toDate/)
 assert.match(bot,/Invalid chat search dates advanced the tour/)
 assert.match(bot,/simulated\.filtersCleared/)
 assert.match(bot,/sender,attachment,dates,query,search,open,clear/)
 assert.doesNotMatch(source,/createClient\(|\.rpc\(|supabase\.from\(/)
})

test('private chat tour matches the production full-conversation delete contract',()=>{
 const source=read('components/training/sandbox-chat-training.tsx')
 const bot=read('scripts/15-bot-browser-test.mjs')
 const migration=read('supabase/migrations/20261006121000_private_chat_management.sql')
 const client=read('components/crew/chat-client.tsx')
 assert.match(migration,/delete from public\.chat_channels where id=p_channel/)
 assert.match(client,/upt_delete_private_chat/)
 assert.match(source,/next\.messages=next\.messages\.filter\(m=>m\.channel!=="private"\)/)
 assert.match(source,/Private chat and its messages deleted/)
 assert.match(bot,/simulated\.retainedPrivate!==0/)
 assert.doesNotMatch(client,/upt_delete_message/)
})

test('combined chat search checks the actual message body, not attachment filename alone',()=>{
 const sandbox=read('components/training/sandbox-chat-training.tsx')
 const production=read('supabase/migrations/20261006124500_chat_experience_upgrade.sql')
 assert.match(sandbox,/m\.body\.toLowerCase\(\)\.includes\(keyword\)/)
 assert.doesNotMatch(sandbox,/\(m\.body\+" "\+m\.attachment\)/)
 assert.match(sandbox,/body:T\(l,"Demo-bijlage"/)
 assert.match(production,/coalesce\(m\.body,''\) ilike/)
})
