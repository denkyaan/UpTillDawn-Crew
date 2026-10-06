import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('offline shell script is syntactically valid and keeps ordered dependency references', async () => {
  const html = await readFile(new URL('../public/offline.html', import.meta.url), 'utf8')
  const match = html.match(/<script>([\s\S]*?)<\/script>/)
  assert.ok(match, 'offline shell must contain an inline script')
  assert.doesNotThrow(() => new Function(match[1]))

  assert.match(match[1], /session_operation_id/)
  assert.match(match[1], /break_operation_id/)
  assert.match(match[1], /incident_photo/)
  assert.match(match[1], /uptilldawn-offline-shell/)
  assert.match(match[1], /navigator\.geolocation/)
})

test('service worker caches the current offline shell version', async () => {
  const sw = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8')
  assert.match(sw, /uptilldawn-public-v12/)
  assert.match(sw, /\/offline\.html/)
  assert.match(sw, /\/offline-public\.html/)
  assert.match(sw, /event\.request\.mode==='navigate'/)
  assert.match(sw, /publicRoute\?caches\.match\(['"]\/offline-public\.html['"]\):privateOfflineResponse\(\)/)
  assert.match(sw, /async function privateOfflineResponse\(\)/)
  assert.match(sw, /offline-content\.js/)
})


test('all public auth routes use the privacy-safe offline fallback', async () => {
  const sw = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8')
  for (const route of ['/signup','/forgot-password','/verify-email','/disabled','/unauthorized']) {
    assert.ok(sw.includes(`url.pathname==='${route}'`), `${route} must be treated as public offline`)
  }
})


test('offline operational content can queue checklist guestlist and sales actions', async () => {
  const content = await readFile(new URL('../public/offline-content.js', import.meta.url), 'utf8')
  const sync = await readFile(new URL('../components/crew/global-offline-content-sync.tsx', import.meta.url), 'utf8')
  const center = await readFile(new URL('../components/crew/sync-center.tsx', import.meta.url), 'utf8')
  assert.match(content,/enqueue\(userId,'checklist_item'/)
  assert.match(content,/enqueue\(userId,'guestlist_checkin'/)
  assert.match(content,/enqueue\(userId,'sale'/)
  assert.match(sync,/saveOfflineGuestlistAndSales/)
  assert.match(sync,/event_guestlist_entries/)
  assert.match(sync,/sale_enabled/)
  assert.match(center,/guestlist_checkin/)
  assert.match(center,/checklist_item/)
  assert.match(center,/sale:/)
})

test('public offline fallback supports all four UI locales', async () => {
  const html = await readFile(new URL('../public/offline-public.html', import.meta.url), 'utf8')
  for (const locale of ['nl','fr','en','de']) assert.match(html, new RegExp(locale + ':\\{'))
  assert.match(html, /navigator\.languages/)
  assert.match(html, /document\.documentElement\.lang=locale/)
})

test('operational offline shell selects NL FR EN or DE from device locale', async () => {
  const html = await readFile(new URL('../public/offline.html', import.meta.url), 'utf8')
  for (const locale of ['nl','fr','en','de']) assert.match(html, new RegExp(locale + ':\\{title:'))
  assert.match(html, /navigator\.languages/)
  assert.match(html, /document\.documentElement\.lang=offlineLocale/)
  assert.match(html, /OFFLINE_COPY\[offlineLocale\]/)
})

test('offline operational content uses the same four-language device locale contract', async () => {
  const content = await readFile(new URL('../public/offline-content.js', import.meta.url), 'utf8')
  for (const locale of ['nl','fr','en','de']) assert.match(content,new RegExp(locale+":\\{saved:"))
  assert.match(content,/navigator\.languages/)
  assert.match(content,/const localeTag=/)
  assert.match(content,/status\.textContent=T\.saved/)
  assert.match(content,/section\(T\.guestlist/)
  assert.match(content,/section\(T\.sales/)
})
