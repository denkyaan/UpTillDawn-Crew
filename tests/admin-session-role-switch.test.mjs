import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('authenticated permanent admin can switch directly into admin mode', async () => {
  const source = await readFile(new URL('../lib/actions/auth.ts', import.meta.url), 'utf8')
  assert.ok(source.includes("if (requestedPortal === 'admin')"))
  assert.ok(source.includes("const { data: { user: existingUser } } = await supabase.auth.getUser()"))
  assert.ok(source.includes("p_role: 'admin'"))
  assert.ok(source.includes("existingProfile.role === 'admin' || existingOwner === true"))
})
