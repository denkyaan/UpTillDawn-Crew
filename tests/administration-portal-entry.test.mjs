import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
test('approved administration users enter their own portal without weakening admin routing',async()=>{
 const source=await readFile(new URL('../app/(app)/page.tsx',import.meta.url),'utf8')
 assert.match(source,/if\(current\.isAdmin\)redirect\('\/admin'\)/)
 assert.match(source,/upt_my_portal_assignments/)
 assert.match(source,/!assignmentError && current\.approved && !current\.account_blocked/)
 assert.match(source,/grant\.role==='administrative_staff'/)
 assert.match(source,/grant\.revoked_at===null/)
 assert.match(source,/redirect\('\/portals\/administration'\)/)
})
