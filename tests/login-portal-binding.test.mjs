import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('all portals share the same login UI while admin submits natively', async () => {
  const route = await readFile(new URL('../app/(auth)/login/[portal]/page.tsx', import.meta.url), 'utf8')
  const form = await readFile(new URL('../components/auth/login-form.tsx', import.meta.url), 'utf8')
  const admin = await readFile(new URL('../app/(auth)/login/admin/page.tsx', import.meta.url), 'utf8')

  assert.ok(route.includes("<LoginForm portal={portal as Portal} />"))
  assert.ok(form.includes('<input type="hidden" name="portal" value={portal} />'))
  assert.ok(form.includes('type="text" inputMode="email" autoComplete="username"'))
  assert.ok(admin.includes('<LoginForm portal="admin" nativeAction="/api/auth/admin-login"'))
})
