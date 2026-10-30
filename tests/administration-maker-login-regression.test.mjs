import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync('lib/actions/auth.ts','utf8')
test('verified maker and permanent Admin portal access do not depend on assignment lookup availability',()=>{
 const signIn=source.slice(source.indexOf('export async function signIn('),source.indexOf('export async function signInAdmin('))
 assert.ok(signIn.indexOf('const hasPermanentAdminAccess')<signIn.indexOf("supabase.rpc('upt_my_portal_assignments')"))
 assert.match(signIn,/if \(\(requestedPortal === 'promotion' \|\| requestedPortal === 'administration'\) && !hasPermanentAdminAccess\)/)
 assert.match(signIn,/isOwner === true \|\| \(profile.approved === true && role === 'admin'\)/)
 assert.match(signIn,/if \(assignmentError\)/)
 assert.match(signIn,/assignedPortalAccess \|\| hasPermanentAdminAccess/)
})
test('administration login selects Admin view for an already privileged account',()=>{
 assert.match(source,/requestedRoleMode = requestedPortal === 'admin' \|\| requestedPortal === 'administration' \? 'admin'/)
})
