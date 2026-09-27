import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('dynamic login routes bind the requested portal server-side', async () => {
  const route = await readFile(new URL('../app/(auth)/login/[portal]/page.tsx', import.meta.url), 'utf8')
  const form = await readFile(new URL('../components/auth/login-form.tsx', import.meta.url), 'utf8')

  assert.ok(route.includes("portal !== 'staff' && portal !== 'responsible' && portal !== 'admin'"))
  assert.ok(route.includes("<LoginForm portal={portal as Portal} />"))
  assert.ok(form.includes('<input type="hidden" name="portal" value={portal} />'))
  assert.ok(form.includes('type="text" inputMode="email" autoComplete="username"'))
  assert.ok(!form.includes('formData.set("portal", portal)'))
})
