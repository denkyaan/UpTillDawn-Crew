import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('feature flags keep risky roadmap modules disabled by default', async () => {
  const source = await readFile(new URL('../lib/feature-flags.ts', import.meta.url), 'utf8')
  for (const flag of ['automationEngine','eventLifecycle','eventTemplates','postEventReports','inventory','transport','documentCenter','kioskMode','multiTenant']) {
    assert.match(source, new RegExp(`${flag}: false`), `${flag} must remain opt-in until implemented and validated`)
  }
})

test('product surfaces preserve role boundaries', async () => {
  const source = await readFile(new URL('../lib/platform-capabilities.ts', import.meta.url), 'utf8')
  assert.match(source, /employee: \['crew'\]/)
  assert.match(source, /responsible: \['crew', 'operations'\]/)
  assert.match(source, /admin: \['crew', 'operations', 'control-center'\]/)
  assert.match(source, /role === 'admin' && !compactViewport/)
  assert.match(source, /role === 'responsible'/)
})
