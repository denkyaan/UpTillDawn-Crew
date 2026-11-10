import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('all portals share the same login UI and Admin uses the verified Server Action', async () => {
  const route = await readFile(new URL('../app/(auth)/login/[portal]/page.tsx', import.meta.url), 'utf8')
  const form = await readFile(new URL('../components/auth/login-form.tsx', import.meta.url), 'utf8')
  const admin = await readFile(new URL('../app/(auth)/login/admin/page.tsx', import.meta.url), 'utf8')

  assert.ok(route.includes("<LoginForm portal={portal as Portal} />"))
  assert.ok(form.includes('<input type="hidden" name="portal" value={portal} />'))
  assert.ok(form.includes('type="text" inputMode="email" autoComplete="username"'))
  assert.ok(admin.includes('<LoginForm portal="admin" initialError={error} />'))
  assert.ok(!admin.includes('nativeAction='))
  assert.match(form,/await signIn\(formData\)/)
  assert.match(form,/window\.location\.assign\(result\.redirectTo\)/)
})


test('shared Admin and Maker login preserves role, ownership, reauthentication and server-side audit', async () => {
  const auth = await readFile(new URL('../lib/actions/auth.ts', import.meta.url), 'utf8')
  assert.match(auth,/supabase\.auth\.signInWithPassword\(\{ email, password \}\)/)
  assert.match(auth,/requestedPortal === 'admin' \? hasPermanentAdminAccess/)
  assert.match(auth,/supabase\.rpc\('upt_set_admin_role_mode'/)
  assert.match(auth,/adminSecurityRpc\(supabase, 'upt_admin_login_success'/)
  assert.match(auth,/isOwner === true\s*\?\s*\(requestedPortal/)
  assert.match(auth,/await notifySecurity\('success', 'login_success'\)/)
})
