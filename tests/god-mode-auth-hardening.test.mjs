import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

test('God Mode authentication is permanently owner-bound',async()=>{
  const [actions,legacy,setup,migration]=await Promise.all([
    readFile(new URL('../lib/actions/god-mode.ts',import.meta.url),'utf8'),
    readFile(new URL('../lib/actions/god-mode-login.ts',import.meta.url),'utf8'),
    readFile(new URL('../app/god-mode/setup/page.tsx',import.meta.url),'utf8'),
    readFile(new URL('../supabase/migrations/20261006220000_god_mode_owner_bound_sessions.sql',import.meta.url),'utf8'),
  ])
  assert.match(actions,/const GOD_LOGIN='godmode@uptilldawn'/)
  assert.match(setup,/value="godmode@uptilldawn"/)
  assert.match(actions,/rpc\('upt_god_login_owner'\)/)
  assert.doesNotMatch(actions,/rpc\('upt_god_login',/)
  assert.doesNotMatch(legacy,/upt_god_login/)
  assert.match(legacy,/redirect\('\/login\/admin'\)/)
  assert.match(migration,/auth\.uid\(\) is not null/)
  assert.match(migration,/upt_private\.is_app_owner\(auth\.uid\(\)\)/)
  assert.match(migration,/revoke all on function public\.upt_god_login\(text,text\) from public,anon/)
  assert.match(migration,/if not upt_private\.god_session_valid\(p_token\) then return; end if;/)
})
