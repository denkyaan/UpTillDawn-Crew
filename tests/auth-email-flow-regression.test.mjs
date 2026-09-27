import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8')

test('auth email routes match configured Supabase templates end to end', async () => {
  const [middleware, callback, recovery, confirm, forgot, reset, actions] = await Promise.all([
    read('lib/supabase/middleware.ts'),
    read('app/auth/callback/route.ts'),
    read('app/(auth)/auth/recovery/page.tsx'),
    read('app/(auth)/auth/confirm/page.tsx'),
    read('app/(auth)/forgot-password/page.tsx'),
    read('app/auth/reset-password/page.tsx'),
    read('lib/actions/auth.ts'),
  ])

  assert.match(middleware, /['"]\/auth\/recovery['"]/)
  assert.match(middleware, /['"]\/auth\/confirm['"]/)
  assert.match(middleware, /['"]\/auth\/reset-password['"]/)
  assert.match(middleware, /['"]\/auth\/callback/)

  assert.match(recovery, /action="\/auth\/callback"/)
  assert.match(recovery, /name="type" value="recovery"/)
  assert.match(recovery, /name="next" value="\/auth\/reset-password"/)

  for (const type of ['email', 'signup', 'invite', 'magiclink', 'recovery', 'email_change']) {
    assert.ok(callback.includes(`'${type}'`), `callback must accept ${type}`)
  }

  for (const type of ['invite', 'email_change', 'magiclink']) {
    assert.ok(confirm.includes(`'${type}'`), `confirmation gate must accept ${type}`)
  }
  assert.match(confirm, /action="\/auth\/callback"/)

  assert.match(actions, /MAKER_ACCOUNT_EMAIL = 'steegmans\.kyani@icloud\.com'/)
  assert.match(actions, /resetPasswordForEmail\(email/)
  assert.match(reset, /updatePassword\(formData\)/)
  assert.match(forgot, /invalid_or_expired/)
})
