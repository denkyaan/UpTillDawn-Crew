import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('admin login uses native POST endpoint and always reauthenticates', async () => {
  const route = await readFile(new URL('../app/api/auth/admin-login/route.ts', import.meta.url), 'utf8')
  const page = await readFile(new URL('../app/(auth)/login/admin/page.tsx', import.meta.url), 'utf8')

  assert.ok(route.includes("supabase.auth.signInWithPassword({ email, password })"))
  assert.ok(route.includes("p_role: 'admin'"))
  assert.ok(route.includes("'/maker-mode?portal=admin'"))
  assert.ok(page.includes('nativeAction="/api/auth/admin-login"'))
})
