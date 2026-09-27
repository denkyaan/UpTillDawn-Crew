import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('scanner-safe recovery gate remains publicly reachable', async () => {
  const source = await readFile(new URL('../lib/supabase/middleware.ts', import.meta.url), 'utf8')
  assert.match(source, /['"]\/auth\/recovery['"]/)
})
