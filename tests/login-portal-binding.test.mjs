import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('staff and responsible use shared portal form while admin has a native server form', async () => {
  const route = await readFile(new URL('../app/(auth)/login/[portal]/page.tsx', import.meta.url), 'utf8')
  const form = await readFile(new URL('../components/auth/login-form.tsx', import.meta.url), 'utf8')
  const admin = await readFile(new URL('../app/(auth)/login/admin/page.tsx', import.meta.url), 'utf8')

  assert.ok(route.includes("<LoginForm portal={portal as Portal} />"))
  assert.ok(form.includes('<input type="hidden" name="portal" value={portal} />'))
  assert.ok(form.includes('type="text" inputMode="email" autoComplete="username"'))
  assert.ok(!form.includes('formData.set("portal", portal)'))
  assert.ok(admin.includes('<form action={signInAdmin}'))
})
