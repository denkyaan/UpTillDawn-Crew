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

  assert.match(auth,/needsOwnerCheck = Boolean\(profile\.account_blocked\) \|\| !profile\.approved \|\| realRole === 'admin'/)
  assert.match(auth,/if \(profile\.account_blocked && !isOwner\) return null/)

  assert.match(providers,/needsOwnerCheck=Boolean\(data\.account_blocked\)\|\|!data\.approved\|\|role==="admin"/)
  assert.match(providers,/data\.account_blocked&&!owner/)
})
