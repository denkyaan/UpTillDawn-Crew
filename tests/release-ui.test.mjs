import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

// Release UI regression coverage. These tests intentionally inspect the
// production source so role/navigation/security invariants cannot drift
// silently during God Mode or performance changes.

test('admin live personnel and running shift cards use digital clocks and workplace sorting', async () => {
  const admin = await read('app/(app)/admin/page.tsx')
  const timers = await read('components/admin/live-operations-timers.tsx')
  assert.match(admin, /AdminActivePersonnel/)
  assert.match(admin, /AdminRunningShifts/)
  assert.match(admin, /responsibleKeys/)
  assert.match(timers, /localeCompare\(b\.name,'nl'\)/)
  assert.match(timers, /Number\(b\.isResponsible\)-Number\(a\.isResponsible\)/)
  assert.match(timers, /WERK/)
  assert.match(timers, /PAUZE/)
  assert.match(timers, /Startuur/)
  assert.match(timers, /font-mono/)
})

test('personal work screen uses live work and pause clocks without payable metric', async () => {
  const operations = await read('app/(app)/operations/operations-client.tsx')
  assert.match(operations, /LiveWorkSummary/)
  assert.match(operations, /formatDigital/)
  assert.match(operations, /Pauze over/)
  assert.doesNotMatch(operations, /Betaalbaar:/)
  assert.doesNotMatch(operations, /net_payable_seconds/)
})

test('responsible overview live timers avoid periodic server polling', async () => {
  const dashboard = await read('app/(app)/page.tsx')
  const live = await read('components/responsible/responsible-live-personnel.tsx')
  assert.match(dashboard, /responsible_assignments/)
  assert.match(dashboard, /upt_responsible_crew_directory/)
  assert.match(dashboard, /upt_manager_live_sessions/)
  assert.match(dashboard, /break_sessions/)
  assert.match(dashboard, /Personeel van mijn werkplek/)
  assert.match(dashboard, /ResponsibleLivePersonnel/)
  assert.match(live, /PAUZE/)
  assert.match(live, /WERKT/)
  assert.match(live, /Pauzetimer/)
  assert.match(live, /Werktimer/)
  assert.match(live, /setInterval\(\(\)=>setNow\(Date\.now\(\)\),1000\)/)
  assert.doesNotMatch(live, /router\.refresh\(\)/)
  assert.doesNotMatch(live, /15000/)
})

test('operations refresh is event-driven instead of periodic', async () => {
  const operations = await read('app/(app)/operations/operations-client.tsx')
  assert.match(operations, /addEventListener\('online',refresh\)/)
  assert.match(operations, /addEventListener\('focus',refresh\)/)
  assert.match(operations, /visibilitychange/)
  assert.doesNotMatch(operations, /setInterval\(\(\)=>\{if\(navigator\.onLine\)router\.refresh\(\)\},15000\)/)
})
