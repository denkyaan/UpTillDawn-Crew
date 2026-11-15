import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('Admin and Maker use shared sign-in and preserve role mode and Owner redirect', async () => {
  const action = await readFile(new URL('../lib/actions/auth.ts', import.meta.url), 'utf8')
  const page = await readFile(new URL('../app/(auth)/login/admin/page.tsx', import.meta.url), 'utf8')
  const form = await readFile(new URL('../components/auth/login-form.tsx', import.meta.url), 'utf8')
  const handler = await readFile(new URL('../app/api/auth/portal-login/route.ts', import.meta.url), 'utf8')

  assert.ok(page.includes('<LoginForm portal="admin" />'))
  assert.ok(page.includes('force-static'))
  assert.ok(form.includes('await signInFromStaticShell(formData)'))
  assert.ok(handler.includes('await signIn(form)'))
  assert.ok(handler.includes("'administration','admin'"))
  assert.ok(!page.includes('nativeAction='))
  assert.ok(form.includes('onSubmit={nativeAction ? undefined : handleSubmit}'))
  assert.ok(action.includes('supabase.auth.signInWithPassword({ email, password })'))
  assert.ok(action.includes("p_role: requestedRoleMode"))
  assert.ok(action.includes("requestedPortal === 'admin' ? hasPermanentAdminAccess"))
  assert.ok(action.includes("`/maker-mode?portal=${requestedPortal}`"))
})
