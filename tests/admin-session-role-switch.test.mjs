import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('admin login always reauthenticates through the native server flow', async () => {
  const auth = await readFile(new URL('../lib/actions/auth.ts', import.meta.url), 'utf8')
  const page = await readFile(new URL('../app/(auth)/login/admin/page.tsx', import.meta.url), 'utf8')

  assert.ok(auth.includes('export async function signInAdmin(formData: FormData)'))
  assert.ok(auth.includes("adminForm.set('portal', 'admin')"))
  assert.ok(!auth.includes('const { data: { user: existingUser } } = await supabase.auth.getUser()'))
  assert.ok(page.includes('<form action={signInAdmin}'))
  assert.ok(page.includes('placeholder="maker@uptilldawn"'))
})
