import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
test('push settings belong to management instead of the notification feed',async()=>{
 const settings=await readFile(new URL('../app/(app)/settings/page.tsx',import.meta.url),'utf8')
 const notifications=await readFile(new URL('../app/(app)/notifications/page.tsx',import.meta.url),'utf8')
 assert.match(settings,/<PushNotificationSettings\/>/)
 assert.doesNotMatch(notifications,/PushNotificationSettings/)
})
test('God Mode management navigation is visible only for owner RPC',async()=>{
 const settings=await readFile(new URL('../app/(app)/settings/page.tsx',import.meta.url),'utf8')
 assert.match(settings,/rpc\('upt_current_is_owner'\)/)
 assert.match(settings,/isOwner===true&&<AdminCard href="\/god-mode\/login"/)
})
