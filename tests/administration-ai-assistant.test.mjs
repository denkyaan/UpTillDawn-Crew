import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const api=readFileSync('app/api/administration/assistant/route.ts','utf8')
const page=readFileSync('app/(app)/portals/administration/modules/ai/page.tsx','utf8')
const chat=readFileSync('components/administration/administration-ai-chat.tsx','utf8')
test('administration AI route checks portal permissions and validates request',()=>{
 assert.match(api,/canOpenPortal\("administration"/)
 assert.match(api,/account_blocked/)
 assert.match(api,/schema\.safeParse/)
 assert.match(api,/sec-fetch-site/)
 assert.match(api,/read-only Up Till Dawn/)
})
test('administration AI has real interactive form and four languages',()=>{
 assert.match(page,/AdministrationAiChat/)
 assert.match(chat,/fetch\("\/api\/administration\/assistant"/)
 for(const locale of ['nl','fr','en','de'])assert.match(chat,new RegExp('\\b'+locale+':\\{title:'))
})
