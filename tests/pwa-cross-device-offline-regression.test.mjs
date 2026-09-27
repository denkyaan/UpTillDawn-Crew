import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('offline browse snapshot includes assigned events workplaces and shifts', async () => {
  const snapshot = await readFile(new URL('../lib/crew-offline-snapshot.ts', import.meta.url), 'utf8')
  const sync = await readFile(new URL('../components/crew/global-offline-content-sync.tsx', import.meta.url), 'utf8')
  const renderer = await readFile(new URL('../public/offline-content.js', import.meta.url), 'utf8')

  for (const field of ['events','workplaces','shifts']) assert.match(snapshot, new RegExp(field + ':'))
  assert.match(sync, /saveOfflineBrowseData/)
  assert.match(sync, /event_members/)
  assert.match(sync, /\.from\('workplaces'\)/)
  assert.match(sync, /\.from\('shifts'\)/)
  for (const title of ['Evenementen offline','Werkplekken offline','Shifts offline']) assert.ok(renderer.includes(title))
})

test('installed PWA keeps the cross-device capability contract', async () => {
  const manifest = await readFile(new URL('../app/manifest.ts', import.meta.url), 'utf8')
  const register = await readFile(new URL('../components/pwa-register.tsx', import.meta.url), 'utf8')
  const sw = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8')

  const deviceContracts = {
    ios: ['display:\'standalone\'', 'start_url:\'/\''],
    android: ['display:\'standalone\'', 'theme_color:\'#050505\''],
    windows: ['display:\'standalone\'', 'scope:\'/\''],
  }
  for (const requirements of Object.values(deviceContracts)) {
    for (const requirement of requirements) assert.ok(manifest.includes(requirement), requirement)
  }

  assert.match(register, /serviceWorker\.register\("\/sw\.js"/)
  assert.match(register, /registration\.update\(\)/)
  assert.match(register, /visibilitychange/)
  assert.match(register, /window\.addEventListener\("online"/)
  assert.match(register, /window\.addEventListener\("focus"/)
  assert.match(register, /periodicSync/)
  assert.match(sw, /pushsubscriptionchange/)
  assert.match(sw, /notificationclick/)
  assert.match(sw, /periodicsync/)
  assert.match(sw, /safeLocalPath/)
})
