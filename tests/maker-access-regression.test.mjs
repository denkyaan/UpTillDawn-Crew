import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { isMakerLogin, resolveLoginEmail, MAKER_ACCOUNT_EMAIL } from '../lib/maker-login.ts'

test('only the supported maker login and canonical account resolve to the permanent maker account',()=>{
  for(const login of ['maker@uptilldawn',MAKER_ACCOUNT_EMAIL]){
    assert.equal(isMakerLogin(login),true)
    assert.equal(resolveLoginEmail(login),MAKER_ACCOUNT_EMAIL)
  }
  assert.equal(isMakerLogin('maker@upilldawn'),false)
  assert.equal(resolveLoginEmail('maker@upilldawn'),'maker@upilldawn')
  assert.equal(isMakerLogin('staff@uptilldawn'),false)
})

test('maker login cannot be locked out by admin guard and verified owner can enter every portal',async()=>{
  const [auth,adminRoute]=await Promise.all([
    readFile(new URL('../lib/actions/auth.ts',import.meta.url),'utf8'),
    readFile(new URL('../app/api/auth/admin-login/route.ts',import.meta.url),'utf8'),
  ])

  assert.match(auth,/requestedPortal === 'admin' && !makerLogin/)
  assert.match(auth,/profile\.account_blocked && isOwner !== true/)
  assert.match(auth,/hasPermanentAdminAccess = isOwner === true/)
  assert.match(auth,/\/maker-mode\?portal=\$\{requestedPortal\}/)
  assert.match(auth,/requestedPortal === 'responsible'.*hasPermanentAdminAccess/s)
  assert.match(auth,/requestedPortal === 'staff'.*hasPermanentAdminAccess/s)

  assert.match(adminRoute,/if \(!makerLogin\) \{[\s\S]*upt_admin_login_guard/)
  assert.match(adminRoute,/isOwner === true \|\| \(!profileError/)
  assert.match(adminRoute,/isOwner === true[\s\S]*maker-mode\?portal=admin/)
})
