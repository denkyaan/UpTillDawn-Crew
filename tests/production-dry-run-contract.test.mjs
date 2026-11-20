import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')

test('production dry run permanently covers the full human event journey',async()=>{
 const browser=await read('scripts/15-bot-browser-test.mjs')
 const ci=await read('.github/workflows/ci.yml')
 const seed=await read('scripts/seed-15-bot-users.mjs')
 const operations=await read('app/(app)/operations/operations-client.tsx')
 const dashboard=await read('app/(app)/page.tsx')
 const queue=await read('components/crew/queue-status.tsx')
 const chat=await read('components/crew/chat-client.tsx')
 const notifications=await read('app/(app)/notifications/page.tsx')

 for(const step of ['availability','briefing','guestlist','task','inventory','chat','incident','timesheet','closure'])assert.ok(browser.toLowerCase().includes(step),step)
 for(const role of ['admin','responsible','staff'])assert.ok(seed.toLowerCase().includes(role),role)
 for(const driver of ['START DRIVING','STOP DRIVING','upt_start_driving','upt_stop_driving','GPS-kilometers'])assert.ok(operations.includes(driver),driver)
 assert.match(dashboard,/upt_manager_live_sessions/)
 assert.match(dashboard,/break_sessions/)
 for(const state of ['offline','pending','syncing','error','synced'])assert.ok(queue.includes(state),state)
 for(const chatFeature of ['replyTo','mentionState','typingUsers','searchResults','pinsByChannel','upt_set_chat_mute'])assert.ok(chat.includes(chatFeature),chatFeature)
 assert.match(notifications,/upt_notification_badge_count/)
 assert.match(notifications,/NotificationOpenLink/)
 assert.match(ci,/Run production-style dry run contract/)
})

test('production dry run remains a mandatory CI gate',async()=>{
 const ci=await read('.github/workflows/ci.yml')
 assert.match(ci,/node --test tests\/production-dry-run-contract\.test\.mjs/)
 assert.match(ci,/Run 15 concurrent authenticated browser bots/)
 assert.match(ci,/Verify browser action persistence/)
 assert.match(ci,/Full event lifecycle release gate/)
})
