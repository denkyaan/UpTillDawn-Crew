import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const sql=readFileSync(new URL('../supabase/migrations/20261103090000_provider_event_mappings.sql',import.meta.url),'utf8')
test('provider mappings are unique and tied to a real internal event',()=>{
 assert.match(sql,/unique\(provider,external_event_id\)/i)
 assert.match(sql,/event_id uuid not null references public\.events\(id\)/i)
 assert.match(sql,/check \(provider in \('eventix','sumup'\)\)/i)
})
test('mapping records are access-controlled and disabled by default',()=>{
 assert.match(sql,/enabled boolean not null default false/i)
 assert.match(sql,/enable row level security/i)
 assert.match(sql,/upt_can_manage_administration\(\)/i)
 assert.match(sql,/revoke all on public\.admin_provider_event_mappings from public,anon/i)
})
test('mapping deletion and external identifier mutation are not granted',()=>{
 assert.doesNotMatch(sql,/grant delete\b/i)
 assert.match(sql,/grant update \(event_id,enabled,updated_at\)/i)
})
