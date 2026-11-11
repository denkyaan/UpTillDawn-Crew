import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

test('Admin and Maker sign in using the same verified portal server action as other roles',async()=>{
 const [page,form,auth]=await Promise.all([
  readFile(new URL('../app/(auth)/login/admin/page.tsx',import.meta.url),'utf8'),
  readFile(new URL('../components/auth/login-form.tsx',import.meta.url),'utf8'),
  readFile(new URL('../lib/actions/auth.ts',import.meta.url),'utf8'),
 ])
 assert.match(page,/<LoginForm portal="admin" initialError=\{error\}/)
 assert.doesNotMatch(page,/nativeAction=|\/api\/auth\/admin-login/)
 assert.match(form,/onSubmit=\{nativeAction \? undefined : handleSubmit\}/)
 assert.match(form,/data-login-hydrated=\{hydrated \? "true" : "false"\}/)
 assert.match(auth,/const hasPermanentAdminAccess = isOwner === true \|\| \(profile\.approved === true && role === 'admin'\)/)
 assert.match(auth,/requestedPortal === 'admin' \? hasPermanentAdminAccess/)
 assert.match(auth,/const redirectTo = isOwner === true/)
 assert.match(auth,/\? \(requestedPortal === 'promotion' \|\| requestedPortal === 'administration' \? '\/portals\/' \+ requestedPortal : `\/maker-mode\?portal=\$\{requestedPortal\}`\)/)
})
