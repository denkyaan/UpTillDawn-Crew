import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('password recovery uses a user-click gate before consuming the one-time token', async () => {
  const gate = await readFile(new URL('../app/(auth)/auth/recovery/page.tsx', import.meta.url), 'utf8')
  assert.match(gate, /form action="\/auth\/callback" method="get"/)
  assert.match(gate, /name="token_hash"/)
  assert.match(gate, /name="type" value="recovery"/)
  assert.match(gate, /Wachtwoord herstellen/)
})
