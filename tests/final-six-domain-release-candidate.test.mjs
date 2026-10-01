import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL('../'+path, import.meta.url), 'utf8')

test('release candidate: God Mode owns three-role visual editing, automation, AI, source and workflow controls', async () => {
  const studio=await read('components/god-mode/god-studio.tsx')
  const builder=await read('components/god-mode/god-visual-builder.tsx')
  const preview=await read('app/api/god/preview-role/route.ts')
  const automation=await read('components/god-mode/god-automation-builder.tsx')
  for(const role of ['staff','responsible_lead','admin']) assert.ok(builder.includes(role),role)
  for(const surface of ['Live Builder','AI tekstuitvoering','Automaties','Programmering','Knoppen & onderdelen','Logica & workflows','Rollen & navigatie','Versies & publicatie']) assert.ok(studio.includes(surface),surface)
  for(const capability of ['Preview toepassen','AI-codevoorstel maken','Functie / knop toevoegen','Thema & kleuren']) assert.ok(builder.includes(capability),capability)
  assert.match(preview,/upt_current_is_owner/)
  assert.match(preview,/upt_set_admin_role_mode/)
  assert.match(automation,/AI-implementatievoorstel maken/)
})

test('release candidate: Admin AI is authenticated, Admin-only, context-grounded and non-mutating', async () => {
  const route=await read('app/api/admin-assistant/route.ts')
  assert.match(route,/crossSite\(request\)/)
  assert.match(route,/upt_is_approved/)
  assert.match(route,/upt_is_admin/)
  for(const source of ['events','upt_operational_alerts','incidents','inventory_items','event_guestlist_entries','artist_backstage_checklists','sales_transactions','sales_registers']) assert.ok(route.includes(source),source)
  assert.match(route,/Gebruik uitsluitend de meegegeven actuele platformcontext/)
  assert.match(route,/Voer geen wijzigingen uit/)
  assert.match(route,/temperature:0\.1/)
})

test('release candidate: PWA, push and offline update safety are represented in the hard gate', async () => {
  const pwa=await read('tests/pwa-cross-device-offline-regression.test.mjs')
  const push=await read('tests/push-security.test.mjs')
  for(const contract of ['ios','android','windows','periodicSync','pushsubscriptionchange','notificationclick','UPT_ACTIVATE_UPDATE','hasPendingCrewData']) assert.ok(pwa.includes(contract),contract)
  assert.match(push,/rejects URL credential and local\/literal host bypasses/)
  assert.match(push,/single-slash local app path/)
})

test('release candidate: security hardening covers auth, privilege, storage, malware/upload and offline revocation', async () => {
  const ci=await read('.github/workflows/ci.yml')
  const upload=await read('tests/upload-security-pipeline.test.mjs')
  for(const suite of ['privilege-matrix.sql','release-access-matrix.sql','storage-security.sql','queued-upload-security.sql','offline-revocation-replay.sql','operational-security.sql']) assert.ok(ci.includes(suite),suite)
  for(const proof of ['signatureMatches','executableExtensions','doubleExtension','validateUploadSecurity']) assert.ok(upload.includes(proof),proof)
  assert.match(ci,/npm audit --audit-level=high/)
  assert.match(ci,/Wrangler deployment dry-run/)
})

test('release candidate: one 15-person event gate covers the complete operational lifecycle', async () => {
  const ci=await read('.github/workflows/ci.yml')
  const browser=await read('scripts/15-bot-browser-test.mjs')
  assert.ok(ci.includes('tests/sql/15-bot-full-event.sql'))
  for(const lifecycle of ['availability','briefing','guestlist','check-in','break-start','break-stop','checkout','timesheet','inventory','chat','incident','closure']) assert.ok(browser.toLowerCase().includes(lifecycle),lifecycle)
  assert.match(browser,/const roles = \['admin', 'responsible', \.\.\.Array\(13\)\.fill\('staff'\)\]/)
  assert.match(browser,/const locales = \['nl', 'fr', 'en', 'de'\]/)
})

test('release candidate: CI keeps the six-domain acceptance gate mandatory', async () => {
  const ci=await read('.github/workflows/ci.yml')
  assert.match(ci,/Full event lifecycle release gate/)
  assert.match(ci,/Run 15 concurrent authenticated browser bots/)
  assert.match(ci,/Full application surface inventory gate/)
  assert.match(ci,/PWA cross-device and offline contract/)
})
