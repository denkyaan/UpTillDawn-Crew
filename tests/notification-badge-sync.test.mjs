import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')

test('PWA badge uses the server badge-count contract instead of raw unread rows',async()=>{
  const config=await read('app/api/push/config/route.ts')
  const client=await read('lib/push-client.ts')
  const page=await read('app/(app)/notifications/page.tsx')
  const sync=await read('components/notification-badge-sync.tsx')

  assert.match(config,/upt_notification_badge_count/)
  assert.doesNotMatch(config,/crew_notifications.*count/s)
  assert.match(client,/export async function syncAppBadgeCount/)
  assert.match(page,/NotificationBadgeSync/)
  assert.match(page,/upt_notification_badge_count/)
  assert.match(sync,/syncAppBadgeCount/)
})

test('push delivery excludes expired operational notifications from the app icon badge',async()=>{
  const source=await read('supabase/functions/push-notification/index.ts')
  assert.match(source,/ephemeralKinds=new Set\(\["check_ins","check_outs","break_warning"\]\)/)
  assert.match(source,/24\*60\*60\*1000/)
  assert.match(source,/Date\.parse\(row\.created_at\)>=badgeCutoff/)
  assert.match(source,/badgeCount:unreadCount\?\?1/)
})

test('stale transient notifications expire automatically and are cleaned on a schedule',async()=>{
  const migration=await read('supabase/migrations/20260928095102_notification_badge_stale_cleanup.sql')
  assert.match(migration,/cleanup_stale_notifications/)
  assert.match(migration,/kind in \('check_ins','check_outs','break_warning'\)/)
  assert.match(migration,/created_at < now\(\)-interval '24 hours'/)
  assert.match(migration,/upt_notification_badge_count/)
  assert.match(migration,/security invoker/)
  assert.match(migration,/uptilldawn-stale-notification-cleanup/)
  assert.match(migration,/\*\/15 \* \* \* \*/)
  assert.match(migration,/select upt_private\.cleanup_stale_notifications\(\)/)
})
