import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const migrationPath = new URL('../supabase/migrations/20260926211500_attendance_request_concurrency_guard.sql', import.meta.url)

test('attendance requests are serialized per user across tabs and devices', async () => {
  const sql = await readFile(migrationPath, 'utf8')

  assert.match(sql, /pg_advisory_xact_lock\s*\(/i)
  assert.match(sql, /hashtextextended\('upt-attendance:'\s*\|\|\s*new\.user_id::text/i)
  assert.match(sql, /from public\.check_ins[\s\S]*ci\.user_id\s*=\s*new\.user_id[\s\S]*ci\.status\s*=\s*'pending'/i)
  assert.match(sql, /from public\.check_outs[\s\S]*co\.user_id\s*=\s*new\.user_id[\s\S]*co\.status\s*=\s*'pending'/i)
  assert.match(sql, /before insert on public\.check_ins/i)
  assert.match(sql, /before insert on public\.check_outs/i)
})

test('attendance concurrency guard is not directly executable by app roles', async () => {
  const sql = await readFile(migrationPath, 'utf8')
  assert.match(sql, /revoke all on function upt_private\.guard_pending_attendance_request\(\)[\s\S]*from public, anon, authenticated/i)
})
