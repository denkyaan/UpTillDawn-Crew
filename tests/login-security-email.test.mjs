import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('successful login sends a personal security email without duplicating the central maker alert', async () => {
  const auth = await readFile(new URL('../lib/actions/auth.ts', import.meta.url), 'utf8')
  const mail = await readFile(new URL('../lib/security-login-email.ts', import.meta.url), 'utf8')

  assert.match(auth, /const accountEmail = data\.user\.email/)
  assert.match(auth, /recipient: accountEmail/)
  assert.match(auth, /audience: 'account'/)
  assert.match(auth, /accountEmail !== centralSecurityEmail/)

  assert.match(mail, /recipient\?: string \| null/)
  assert.match(mail, /audience\?: 'security' \| 'account'/)
  assert.match(mail, /Nieuwe login/)
})
