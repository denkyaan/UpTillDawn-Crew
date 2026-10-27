import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const chat=readFileSync('components/administration/administration-ai-chat.tsx','utf8')
const api=readFileSync('app/api/administration/assistant/route.ts','utf8')
test('AI conversation reset is available in all four locales and disabled while busy',()=>{
 for(const value of ['Gesprek wissen','Effacer la conversation','Clear conversation','Gespräch löschen'])assert.ok(chat.includes(value),value)
 assert.match(chat,/disabled=\{busy\} onClick=\{\(\)=>\{setHistory\(\[\]\)/)
 assert.match(chat,/response\.status===400\?t\.invalid:t\.error/)
})
test('AI history is bounded and cannot execute actions',()=>{
 assert.match(api,/\.max\(8\)\.default\(\[\]\)/)
 assert.match(api,/You cannot approve, modify, send, pay or sign anything/)
 assert.match(chat,/history\.slice\(-8\)/)
})
