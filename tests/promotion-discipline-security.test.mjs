import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

test('promotion discipline applies three strikes before suspension and audits each violation',async()=>{
 const sql=await readFile(new URL('../supabase/migrations/20261023150000_promotion_discipline.sql',import.meta.url),'utf8')
 assert.match(sql,/v_strikes:=v_row\.strikes\+1/)
 assert.match(sql,/if v_strikes>=3 then/)
 assert.match(sql,/set strikes=0,suspension_count=least\(suspension_count\+1,2\)/)
 assert.match(sql,/when suspension_count=0 then now\(\)\+interval '1 month'/)
 assert.match(sql,/permanently_blocked=\(suspension_count>=1\)/)
 assert.match(sql,/promotion_violations_assignment_reason_unique/)
 assert.match(sql,/promotion_violation/)
 assert.match(sql,/Promotion account already blocked/)
})

test('unblocking requires a reason and records an audit entry',async()=>{
 const sql=await readFile(new URL('../supabase/migrations/20261023150000_promotion_discipline.sql',import.meta.url),'utf8')
 const unblock=sql.slice(sql.indexOf('create or replace function public.upt_admin_unblock_promotion'))
 assert.match(unblock,/length\(trim\(coalesce\(p_reason,''\)\)\)<10/)
 assert.match(unblock,/promotion_unblocked/)
 assert.match(unblock,/blocked_until=null,permanently_blocked=false/)
})
