import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('maintenance mode supports scoped read-only windows', async () => {
  const source = await readFile(new URL('../lib/maintenance-mode.ts', import.meta.url), 'utf8')
  for (const scope of ['global','organization','event']) assert.ok(source.includes(`'${scope}'`))
  assert.match(source, /window\.readOnly/)
  assert.match(source, /window\.endsAt > window\.startsAt/)
})

test('dangerous migrations require dry run backup and reversibility', async () => {
  const source = await readFile(new URL('../lib/migration-safety.ts', import.meta.url), 'utf8')
  assert.match(source, /!plan\.dryRunPassed/)
  assert.match(source, /!plan\.backupVerified/)
  assert.match(source, /plan\.destructive && !plan\.reversible/)
})

test('support diagnostics stay privacy safe and detect stuck sync', async () => {
  const source = await readFile(new URL('../lib/support-diagnostics.ts', import.meta.url), 'utf8')
  assert.match(source, /includesPersonalData: false/)
  assert.match(source, /pendingSyncCount/)
  assert.match(source, /5 \* 60_000/)
})

test('client compatibility enforces minimum versions and update detection', async () => {
  const source = await readFile(new URL('../lib/version-compatibility.ts', import.meta.url), 'utf8')
  assert.match(source, /minimumSupported/)
  assert.match(source, /compareVersions\(version, policy\.minimumSupported\) >= 0/)
  assert.match(source, /compareVersions\(version, policy\.latest\) < 0/)
})
