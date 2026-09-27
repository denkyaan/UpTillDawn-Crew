import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('portal login returns a redirect target and client performs navigation', async () => {
  const auth = await readFile(new URL('../lib/actions/auth.ts', import.meta.url), 'utf8')
  const login = await readFile(new URL('../components/auth/login-form.tsx', import.meta.url), 'utf8')

  assert.ok(auth.includes("return { success: true, redirectTo }"))
  assert.ok(auth.includes("'/maker-mode?portal=admin'"))
  assert.ok(login.includes("window.location.assign(result.redirectTo)"))
})
