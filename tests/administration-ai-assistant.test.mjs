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

test('cross-portal AI keeps separate endpoints, permissions and compact mobile chat',()=>{
 const layout=readFileSync('components/layout/app-layout.tsx','utf8')
 const adminApi=readFileSync('app/api/admin-assistant/route.ts','utf8')
 const adminPage=readFileSync('app/(app)/portals/administration/modules/ai/page.tsx','utf8')
 assert.match(layout,/effectiveAiWorkspace==="admin"\?<PlatformAiAssistant/)
 assert.match(layout,/<AdministrationAiChat locale=\{uiLocale\} compact\/>/)
 assert.match(chat,/!compact&&<AdministrationAiBookingNotes/)
 assert.match(adminPage,/Boolean\(adminAccess\)&&<details/)
 assert.match(adminApi,/if\(!approved\|\|!isAdmin\)return Response\.json/)
 assert.match(api,/canOpenPortal\("administration"/)
})

test('operational assistant receives UI locale and enforces the same admin permission',()=>{
 const client=readFileSync('components/admin/platform-ai-assistant.tsx','utf8')
 const endpoint=readFileSync('app/api/admin-assistant/route.ts','utf8')
 assert.match(client,/JSON.stringify\(\{message:value,locale,eventId,contextKey\}\)/)
 assert.match(endpoint,/locale:z.enum\(\['nl','fr','en','de'\]\)/)
 assert.match(endpoint,/locale:parsed.data.locale/)
 assert.match(page,/upt_is_admin/)
})

test('administration AI handles malformed responses and Belgian due dates',()=>{
 assert.match(chat,/response\.json\(\)\.catch\(\(\)=>\(\{\}\)\)/)
 assert.match(chat,/typeof payload\.answer==="string"&&payload\.answer\.trim\(\)/)
 assert.match(chat,/aria-busy=\{busy\}/)
 assert.match(api,/timeZone:"Europe\/Brussels"/)
 assert.match(api,/businessTimezone:"Europe\/Brussels"/)
})

test('administration AI responses are private and never cached',()=>{
 assert.match(api,/export const dynamic="force-dynamic"/)
 assert.match(api,/headers:\{"Cache-Control":"no-store"\}/)
 assert.match(chat,/cache:"no-store"/)
 assert.match(api,/generatedAt:now\.toISOString\(\)/)
})

test('operational Admin AI isolates events, limits data exposure and avoids false totals',()=>{
 const endpoint=readFileSync('app/api/admin-assistant/route.ts','utf8')
 const client=readFileSync('components/admin/platform-ai-assistant.tsx','utf8')
 assert.match(endpoint,/artistPresence:eventId\?artistPresence\.filter\(row=>row\.eventId===eventId\):artistPresence/)
 assert.doesNotMatch(endpoint,/spots_checked_in,notes/)
 assert.match(endpoint,/dataLimitations:/)
 assert.match(endpoint,/Cache-Control':'no-store'/)
 assert.match(client,/cache:'no-store'/)
 assert.match(client,/response\.json\(\)\.catch/)
 assert.match(client,/aria-busy=\{busy\}/)
})

test('operational AI identifies failed queries rather than claiming zero records',()=>{
 const endpoint=readFileSync('app/api/admin-assistant/route.ts','utf8')
 for(const name of ['eventsError','alertsError','incidentsError','inventoryError','recoveryError','guestlistError','backstageError','salesError','registersError'])assert.ok(endpoint.includes(name),name)
 assert.match(endpoint,/unavailableSources:/)
 assert.match(endpoint,/Meld expliciet de namen uit unavailableSources/)
})

test('operational sales AI never classifies unknown payments as card or sales as tokens',()=>{
 const endpoint=readFileSync('app/api/admin-assistant/route.ts','utf8')
 assert.match(endpoint,/tx\.payment_method==='card'/)
 assert.match(endpoint,/bucket\.otherPayment\+=amount/)
 assert.match(endpoint,/tx\.sale_category==='tokens'/)
 assert.match(endpoint,/bucket\.otherCategory\+=amount/)
 assert.match(endpoint,/salesClassification:/)
})
