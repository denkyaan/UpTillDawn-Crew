import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8')

test('maker normal app revalidates owner and role mode on the server before navigation',async()=>{
  const [makerPage,auth]=await Promise.all([
    read('app/maker-mode/page.tsx'),
    read('lib/actions/auth.ts'),
  ])

  assert.match(makerPage,/form action=\{enterNormalAppFromMakerSession\}/)
  assert.match(makerPage,/name="portal" value=\{portal\}/)
  assert.doesNotMatch(makerPage,/Link href=\{normalHref\}/)

  assert.match(auth,/export async function enterNormalAppFromMakerSession/)
  assert.match(auth,/upt_current_is_owner/)
  assert.match(auth,/upt_set_admin_role_mode/)
  assert.match(auth,/portal === 'admin' \? 'admin' : portal === 'responsible' \? 'responsible_lead' : 'staff'/)
  assert.match(auth,/redirect\(portal === 'admin' \? '\/admin' : '\/'\)/)
})

test('maker bypass is resolved before ordinary account block gates on server and client',async()=>{
  const [auth,providers]=await Promise.all([
    read('lib/actions/auth.ts'),
    read('lib/providers.tsx'),
  ])

  assert.ok(auth.includes("const { data: ownerFlag } = await supabase.rpc('upt_current_is_owner')"))
  assert.match(auth,/if \(profile\.account_blocked && !isOwner\) return null/)

  assert.match(providers,/needsOwnerCheck=Boolean\(data\.account_blocked\)\|\|!data\.approved\|\|role==="admin"/)
  assert.match(providers,/data\.account_blocked&&!owner/)
})

test('owner effective role SQL respects Maker selection and leaves regular personnel unchanged',async()=>{
 const [migration,sqlTest]=await Promise.all([
  read('supabase/migrations/20261112195755_maker_owner_effective_role_mode_fix.sql'),
  read('tests/sql/owner-leadership-privacy.sql'),
 ])
 assert.match(migration,/when upt_private\.is_app_owner\(auth\.uid\(\)\) then coalesce/)
 assert.match(migration,/m\.active_role in \('admin','staff','responsible_lead'\)/)
 assert.match(migration,/else public\.upt_effective_role\(auth\.uid\(\)\)/)
 assert.match(sqlTest,/public\.upt_current_effective_role\(\) IS DISTINCT FROM 'admin'/)
 assert.match(sqlTest,/public\.upt_set_admin_role_mode\('staff'\)/)
 assert.match(sqlTest,/public\.upt_set_admin_role_mode\('responsible_lead'\)/)
 assert.match(sqlTest,/public\.upt_set_admin_role_mode\('admin'\)/)
})
