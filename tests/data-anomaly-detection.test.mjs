import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

test('data anomaly detection covers critical event inconsistencies',async()=>{
  const migration=await readFile(new URL('../supabase/migrations/20260928215500_data_anomaly_detection.sql',import.meta.url),'utf8')
  for(const contract of [
    "inventory_negative",
    "active_briefing_unread",
    "overlapping_active_sessions",
    "guestlist_overcheck",
    "sales_total_mismatch",
    "sale_without_active_inventory",
    "refresh_data_anomalies()",
    "data-anomaly",
  ])assert.ok(migration.includes(contract),contract)
  assert.match(migration,/cron\.schedule\(/)
  assert.match(migration,/notify_platform_alert/)
  assert.match(migration,/resolved_at=now\(\)/)
})
