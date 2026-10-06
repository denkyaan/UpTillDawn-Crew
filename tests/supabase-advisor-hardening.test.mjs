import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migrationUrl=new URL('../supabase/migrations/20261006210000_supabase_advisor_hardening.sql',import.meta.url)

test('Supabase advisor hardening keeps RPC-only tables explicitly closed',async()=>{
  const sql=await readFile(migrationUrl,'utf8')
  const protectedTables=[
    'admin_role_modes','push_subscriptions','upload_security_scans',
    'admin_login_attempts','admin_login_security_events','app_owners',
    'automation_deliveries','chat_pins','chat_typing_states','chat_user_states',
    'god_data_audit','god_mode_attempts','god_mode_config','god_mode_sessions',
    'operational_alert_deliveries','shift_marketplace_claims'
  ]
  for(const table of protectedTables) assert.match(sql,new RegExp(`'${table}'`))
  assert.match(sql,/for all to anon,authenticated using \(false\) with check \(false\)/)
  assert.doesNotMatch(sql,/grant\s+/i)
})

test('Supabase advisor hardening covers chat foreign keys',async()=>{
  const sql=await readFile(migrationUrl,'utf8')
  assert.match(sql,/chat_pins_message_id_idx[\s\S]*chat_pins\(message_id\)/)
  assert.match(sql,/chat_pins_pinned_by_idx[\s\S]*chat_pins\(pinned_by\)/)
  assert.match(sql,/chat_typing_states_user_id_idx[\s\S]*chat_typing_states\(user_id\)/)
})
