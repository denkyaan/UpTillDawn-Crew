import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

test('God Mode is reachable only through the authenticated maker flow',async()=>{
  const [
    makerLogin,makerPage,actions,legacyLogin,setup,editor,
    securitySurface,privilegeMatrix,ownerMigration,retireMigration,
  ]=await Promise.all([
    readFile(new URL('../lib/maker-login.ts',import.meta.url),'utf8'),
    readFile(new URL('../app/maker-mode/page.tsx',import.meta.url),'utf8'),
    readFile(new URL('../lib/actions/god-mode.ts',import.meta.url),'utf8'),
    readFile(new URL('../lib/actions/god-mode-login.ts',import.meta.url),'utf8'),
    readFile(new URL('../app/god-mode/setup/page.tsx',import.meta.url),'utf8'),
    readFile(new URL('../components/god-mode/god-mode-editor.tsx',import.meta.url),'utf8'),
    readFile(new URL('./sql/security-definer-surface.sql',import.meta.url),'utf8'),
    readFile(new URL('./sql/privilege-matrix.sql',import.meta.url),'utf8'),
    readFile(new URL('../supabase/migrations/20261006220000_god_mode_owner_bound_sessions.sql',import.meta.url),'utf8'),
    readFile(new URL('../supabase/migrations/20261006221000_retire_standalone_god_mode_login.sql',import.meta.url),'utf8'),
  ])

  assert.match(makerLogin,/MAKER_LOGIN_ALIAS = 'maker@uptilldawn'/)
  assert.match(makerPage,/enterGodModeFromMakerSession/)
  assert.match(makerPage,/God Mode/)
  assert.match(actions,/rpc\('upt_current_is_owner'\)/)
  assert.match(actions,/rpc\('upt_god_login_owner'\)/)
  assert.doesNotMatch(actions,/upt_god_login\b/)
  assert.doesNotMatch(actions,/upt_god_set_credentials/)
  assert.match(legacyLogin,/redirect\('\/login\/admin'\)/)
  assert.match(setup,/redirect\('\/login\/admin'\)/)
  assert.doesNotMatch(setup,/password|godmode@uptilldawn|edit@uptilldawn/i)
  assert.doesNotMatch(editor,/href="\/god-mode\/setup"|God login wijzigen/i)

  // Fast preflight for SQL regression fixtures: stale privilege expectations
  // must fail here, before the slower local Supabase replay starts.
  const securityAnonAllowlist=securitySurface.match(/p\.proname <> ALL\(ARRAY\[([\s\S]*?)\]\);/)?.[1] ?? ''
  const privilegeAnonAllowlist=privilegeMatrix.match(/routine_name <> ALL\(ARRAY\[([\s\S]*?)\]\);/)?.[1] ?? ''
  assert.ok(securityAnonAllowlist)
  assert.ok(privilegeAnonAllowlist)
  assert.doesNotMatch(securityAnonAllowlist,/upt_god_/)
  assert.doesNotMatch(privilegeAnonAllowlist,/upt_god_/)
  assert.doesNotMatch(securitySurface,/token-gated God Mode|anonymous God Mode|owner configuration RPC/i)
  assert.doesNotMatch(privilegeMatrix,/token-gated God Mode|Dedicated God Mode error queue/i)
  assert.match(securitySurface,/permanent-maker-only God Mode/)
  assert.match(privilegeMatrix,/God Mode requires the maker session/)

  assert.match(ownerMigration,/auth\.uid\(\) is not null/)
  assert.match(ownerMigration,/upt_private\.is_app_owner\(auth\.uid\(\)\)/)
  assert.match(retireMigration,/revoke all on function public\.upt_god_login\(text,text\) from public,anon,authenticated/)
  assert.match(retireMigration,/revoke all on function public\.upt_god_set_credentials\(text,text\) from public,anon,authenticated/)
  assert.match(retireMigration,/revoke all on function public\.upt_god_is_configured\(\) from public,anon,authenticated/)
})
