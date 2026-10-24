import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
test('reference registration enforces image metadata and ownership in database',async()=>{
 const sql=await readFile(new URL('../supabase/migrations/20261025120000_promotion_reference_upload_hardening.sql',import.meta.url),'utf8')
 assert.match(sql,/o\.owner_id=v_actor::text/)
 assert.match(sql,/promotion-reference\//)
 assert.match(sql,/image\/jpeg/)
 assert.match(sql,/image\/png/)
 assert.match(sql,/image\/webp/)
 assert.match(sql,/10485760/)
 assert.match(sql,/upt_admin_register_promotion_reference/)
})
