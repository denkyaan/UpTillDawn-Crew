import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync('supabase/migrations/20261117185000_chat_hotpath_read_only_realtime.sql','utf8')
const def=name=>{
 const n=source.toLowerCase().indexOf(('create or replace function public.'+name+'(').toLowerCase())
 assert.ok(n>=0,name+' function missing')
 const end=source.indexOf('$function$;',n)
 assert.ok(end>n,name+' function termination missing')
 return source.slice(n,end)
}
test('typing, chat counts and promotion unread counts stay read-only under polling and offline fallback',()=>{
 for(const name of ['upt_chat_typing_users','upt_chat_channel_summaries','upt_promotion_chat_unread_counts']){
  const fn=def(name)
  assert.match(fn,/STABLE SECURITY DEFINER/i)
  assert.doesNotMatch(fn,/\b(delete from|insert into|update\s+upt_private)\b/i)
 }
 assert.match(def('upt_chat_typing_users'),/expires_at>now\(\)/)
 assert.match(def('upt_chat_channel_summaries'),/left join upt_private\.chat_user_states/)
 assert.match(def('upt_chat_channel_summaries'),/m\.created_at>coalesce\(s\.last_read_at,c\.created_at\)/)
 assert.match(def('upt_chat_channel_summaries'),/coalesce\(s\.last_read_at,c\.created_at\) as last_read_at/)
 assert.match(def('upt_promotion_chat_unread_counts'),/m\.created_at>coalesce\(st\.last_read_at,'epoch'::timestamptz\)/)
 assert.doesNotMatch(def('upt_chat_channel_summaries'),/m\.created_at>coalesce\(s\.last_read_at,now\(\)\)/)
 assert.match(def('upt_promotion_chat_unread_counts'),/left join upt_private\.promotion_chat_read_states/)
})
test('only approved channel members can receive private typing and read updates',()=>{
 const guard=def('upt_chat_signal_authorized')
 assert.match(guard,/auth\.uid\(\) is null/)
 assert.match(guard,/upt_is_approved\(\)/)
 assert.match(guard,/upt_can_read_channel\(v_channel\)/)
 assert.match(source,/create policy upt_chat_signal_select on realtime\.messages for select to authenticated/i)
 assert.match(source,/create policy upt_chat_signal_insert on realtime\.messages for insert to authenticated/i)
 assert.match(source,/revoke all on function public\.upt_chat_signal_authorized\(text\) from public,anon/)
 assert.match(def('upt_set_chat_typing'),/realtime\.send/)
 assert.match(def('upt_mark_chat_read'),/realtime\.send/)
 assert.doesNotMatch(def('upt_set_chat_typing'),/where expires_at<=now\(\)/)
})
