import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const sql=readFileSync('supabase/migrations/20261117201500_chat_unread_total_set_based_fastpath.sql','utf8')

test('badge computes exact unread count without invoking heavy channel summaries',()=>{
 assert.match(sql,/create or replace function public\.upt_chat_unread_total\(\)/i)
 assert.match(sql,/with pending as materialized/i)
 assert.match(sql,/count\(\*\)::bigint/)
 assert.match(sql,/sum\(p\.unread_count\)/)
 assert.doesNotMatch(sql,/from public\.upt_chat_channel_summaries\(/i)
 assert.match(sql,/m\.sender_id is distinct from v_actor/)
 assert.match(sql,/m\.moderated_at is null/)
 assert.match(sql,/m\.created_at > coalesce\(st\.last_read_at,now\(\)\)/)
 assert.match(sql,/st\.channel_id = c\.id and st\.user_id = v_actor/)
})
test('inbox fast path retains independent auth, RLS-equivalent authorization and grants',()=>{
 assert.match(sql,/v_actor uuid := auth\.uid\(\)/)
 assert.match(sql,/not public\.upt_is_approved\(\)/)
 assert.match(sql,/when p\.unread_count > 0 then public\.upt_can_read_channel\(p\.channel_id\)/)
 assert.match(sql,/else false/)
 assert.match(sql,/security definer/i)
 assert.match(sql,/set search_path to 'pg_catalog','public','upt_private'/i)
 assert.match(sql,/revoke all on function public\.upt_chat_unread_total\(\) from public,anon;/i)
 assert.match(sql,/grant execute on function public\.upt_chat_unread_total\(\) to authenticated;/i)
 assert.doesNotMatch(sql,/grant execute[^;]* to anon/i)
})
