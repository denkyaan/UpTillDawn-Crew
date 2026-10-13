import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"

const sql=readFileSync(new URL("../supabase/migrations/20261013110000_training_scenarios_staging.sql",import.meta.url),"utf8")
test("training scenario migration explicitly refuses unverified projects",()=>{
 assert.match(sql,/current_setting\('app\.settings\.project_ref', true\) IS DISTINCT FROM 'npbjrtiolqperdgljnhi'/)
 assert.match(sql,/RAISE EXCEPTION/)
})
test("training scenarios are isolated to their owner",()=>{
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/)
 assert.match(sql,/training_scenarios_read[\s\S]*?USING \(owner_id=auth\.uid\(\)\)/)
 assert.match(sql,/training_scenarios_admin_insert[\s\S]*?owner_id=auth\.uid\(\)/)
 assert.match(sql,/training_scenarios_admin_update[\s\S]*?owner_id=auth\.uid\(\)/)
})
