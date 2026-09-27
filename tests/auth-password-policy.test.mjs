import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PASSWORD_MIN_LENGTH, passwordPolicyMessage, validatePassword } from '../lib/password-policy.ts'

test('password policy requires a strong mixed 12 character password', () => {
  assert.equal(PASSWORD_MIN_LENGTH,12)
  assert.equal(validatePassword('CorrectHorse9!').valid,true)
  assert.equal(validatePassword('alllowercase1!').valid,false)
  assert.equal(validatePassword('ALLUPPERCASE1!').valid,false)
  assert.equal(validatePassword('NoDigitsHere!!').valid,false)
  assert.equal(validatePassword('NoSymbolHere1').valid,false)
  assert.equal(validatePassword('Short1!').valid,false)
  assert.match(passwordPolicyMessage('weak')||'',/minstens 12 tekens/)
})

test('signup and reset enforce the shared password policy on server and client', async () => {
  const [actions,signup,reset]=await Promise.all([
    readFile(new URL('../lib/actions/auth.ts',import.meta.url),'utf8'),
    readFile(new URL('../app/(auth)/signup/page.tsx',import.meta.url),'utf8'),
    readFile(new URL('../app/auth/reset-password/page.tsx',import.meta.url),'utf8'),
  ])
  assert.match(actions,/passwordPolicyMessage\(password\)/)
  assert.match(signup,/passwordPolicyMessage\(password\)/)
  assert.match(signup,/PASSWORD_MIN_LENGTH/)
  assert.match(reset,/passwordPolicyMessage\(password\)/)
  assert.match(reset,/PASSWORD_MIN_LENGTH/)
})
