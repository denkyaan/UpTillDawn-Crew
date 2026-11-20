import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('authenticated users can reopen login portals to switch role mode', async () => {
  const source = await readFile(new URL('../lib/supabase/middleware.ts', import.meta.url), 'utf8')
  assert.ok(!source.includes("const authPages = ['/login', '/signup', '/forgot-password']"))
  assert.ok(source.includes("const redirectAuthenticatedAuthPages = ['/signup', '/forgot-password']"))
})
