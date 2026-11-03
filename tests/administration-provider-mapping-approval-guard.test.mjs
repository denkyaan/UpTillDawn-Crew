import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const sql=readFileSync(new URL('../supabase/migrations/20261103120000_provider_mapping_activation_guard.sql',import.meta.url),'utf8')
test('database restricts mapping updates to admin with RLS',()=>{
 assert.match(sql,/drop policy if exists admin_provider_mapping_update/)
 assert.match(sql,/using \(public\.upt_is_admin\(\)\)/)
 assert.match(sql,/with check \(public\.upt_is_admin\(\)\)/)
 assert.match(sql,/grant update \(enabled\)/)
})
test('database prevents enabled inserts and identity changes',()=>{
 assert.match(sql,/new\.enabled is distinct from false/)
 assert.match(sql,/new\.event_id is distinct from old\.event_id/)
 assert.match(sql,/new\.provider is distinct from old\.provider/)
 assert.match(sql,/new\.external_event_id is distinct from old\.external_event_id/)
 assert.match(sql,/new\.created_by is distinct from old\.created_by/)
 assert.match(sql,/new\.updated_at:=now\(\)/)
})
