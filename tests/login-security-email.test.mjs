import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('login security emails cover staff, responsible and admin portal attempts', async () => {
  const auth = await readFile(new URL('../lib/actions/auth.ts', import.meta.url), 'utf8')
  const mail = await readFile(new URL('../lib/security-login-email.ts', import.meta.url), 'utf8')

  assert.match(auth, /const securityRelevant = true/)
  assert.doesNotMatch(auth, /recipient: accountEmail/)
  assert.doesNotMatch(auth, /audience: 'account'/)

  assert.match(mail, /loginpoging/)
  assert.match(mail, /steegmans\.kyani@icloud\.com/)
})
