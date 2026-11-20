import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('login form never falls back to GET before hydration', async () => {
  const source = await readFile(new URL('../components/auth/login-form.tsx', import.meta.url), 'utf8')

  assert.ok(source.includes('method="post"'))
  assert.ok(!source.includes('method={nativeAction ? "post" : undefined}'))
})
