import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('maker chooser is limited to admin and personal routes bypass role gating', async () => {
  const auth = await readFile(new URL('../lib/actions/auth.ts', import.meta.url), 'utf8')
  const layout = await readFile(new URL('../components/layout/app-layout.tsx', import.meta.url), 'utf8')

  assert.ok(auth.includes("const redirectTo = requestedPortal === 'admin' ? '/admin' : '/'"))
  assert.ok(auth.includes("return { success: true, redirectTo }"))
  assert.ok(!auth.includes("redirectTo: submittedEmail === MAKER_LOGIN_ALIAS ? '/maker-mode?portal=admin' : '/admin'"))
  assert.ok(layout.includes('pathname.startsWith("/settings")'))
  assert.ok(layout.includes('personalRoute?null'))
})
