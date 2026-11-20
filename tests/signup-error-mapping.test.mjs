import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('signup maps common Supabase auth failures to actionable messages', async () => {
  const auth=await readFile(new URL('../lib/actions/auth.ts',import.meta.url),'utf8')
  for(const code of [
    'account_exists',
    'email_rate_limit',
    'email_delivery_test_mode',
    'invalid_email',
    'weak_password',
    'signup_disabled',
    'captcha_failed',
    'signup_auth_error',
  ]) assert.ok(auth.includes(code),code)
  assert.ok(auth.includes("return signUpError(error)"))
  assert.ok(!auth.includes("De aanvraag kon niet worden verwerkt. Probeer opnieuw."))
})

test('signup renders support error code and translations cover detailed errors', async () => {
  const page=await readFile(new URL('../app/(auth)/signup/page.tsx',import.meta.url),'utf8')
  const translations=await readFile(new URL('../lib/ui-translation-complete.ts',import.meta.url),'utf8')
  assert.ok(page.includes('serverErrorCode'))
  assert.ok(page.includes('Foutcode:'))
  for(const text of [
    'Registratie kan niet worden afgerond omdat de verificatiemail niet kan worden verzonden.',
    'De verificatiemail kan nu niet worden verzonden omdat de e-maildienst tijdelijk te veel verzoeken ontvangt.',
    'Foutcode',
  ]){
    const line=translations.split('\n').find(row=>row.includes(text))||''
    assert.match(line,/fr:\s*'[^']+'/)
    assert.match(line,/en:\s*'[^']+'/)
    assert.match(line,/de:\s*'[^']+'/)
  }
})
