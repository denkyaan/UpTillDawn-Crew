import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')

test('personnel role control uses a single atomic grant',async()=>{
 const [ui,action]=await Promise.all([read('components/admin/personnel-portal-roles.tsx'),read('lib/actions/portal-roles.ts')])
 assert.match(ui,/update\("assign_approved"\)/)
 assert.doesNotMatch(ui,/if\s*\(action\s*===\s*["']assign["']\)/)
 assert.match(action,/assign_approved/)
 assert.match(action,/current\.realIsAdmin/)
 assert.match(action,/userId === current\.id/)
})

test('database atomic grant enforces approval and duplicate protection',async()=>{
 const sql=await read('supabase/migrations/20261028213000_atomic_portal_role_approval.sql')
 assert.match(sql,/p_action='assign_approved'/)
 assert.match(sql,/values\(p_user_id,p_portal,p_role,true,v_actor,now\(\),null\)/)
 assert.match(sql,/Role already active/)
 assert.match(sql,/portal_role_.*p_action/)
 assert.match(sql,/v_actor = v_actor|p_user_id = v_actor/)
})

test('admin portal assignment read policy remains restricted to approved admins',async()=>{
 const sql=await read('supabase/migrations/20261028210000_portal_role_admin_read.sql')
 assert.match(sql,/actor\.role='admin'/)
 assert.match(sql,/actor\.approved=true/)
 assert.match(sql,/actor\.account_blocked=false/)
})
