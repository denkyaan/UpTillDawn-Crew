import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,readdirSync} from 'node:fs'

const migration=readFileSync('supabase/migrations/20261118103224_bind_privileged_task_and_driver_authorization_to_session.sql','utf8')
const sqlGate=readFileSync('tests/sql/definer-task-driver-actor-binding.sql','utf8')
const baseline=readFileSync('lib/release-baseline.ts','utf8')
const preflight=readFileSync('scripts/production-preflight-readonly.sql','utf8')

test('three SECURITY DEFINER RPCs may only inspect the real signed-in caller',()=>{
 const functions=['upt_can_manage_task','upt_can_read_task','upt_is_driver_supervisor']
 for(const name of functions){
  const start=migration.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`)
  assert.ok(start>=0,'missing '+name)
  const next=migration.indexOf('$$;',start)
  assert.ok(next>start,'missing function terminator for '+name)
  const body=migration.slice(start,next)
  assert.match(body,/p_uid uuid DEFAULT auth\.uid\(\)/)
  assert.match(body,/SECURITY DEFINER/)
  assert.match(body,/p_uid = \(SELECT auth\.uid\(\)\)/)
  assert.match(body,/public\.upt_is_approved\(\)/)
  assert.match(body,/SET search_path = 'pg_catalog','public','pg_temp'/)
  assert.match(migration,new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${name}\\(uuid,uuid\\) TO authenticated`))
  assert.match(migration,new RegExp(`REVOKE ALL ON FUNCTION public\\.${name}\\(uuid,uuid\\) FROM PUBLIC,anon`))
  assert.ok(sqlGate.includes("'"+name+"'"),'missing SQL regression entry for '+name)
 }
})

test('task, driver and active profile entitlements remain intact with original parameters',()=>{
 assert.match(migration,/t\.workplace_id IS NOT NULL AND public\.upt_is_responsible\(t\.event_id,t\.workplace_id,p_uid\)/)
 assert.match(migration,/ta\.task_id=t\.id AND ta\.user_id=p_uid/)
 assert.match(migration,/NOT coalesce\(p\.account_blocked,false\)/)
 assert.match(migration,/lower\(w\.name\) LIKE '%backstage%'/)
 assert.match(sqlGate,/upt_driver_dashboard\(uuid\)/)
})

test('new Main SQL migration and production release preflight use the same immutable baseline',()=>{
 const migrations=readdirSync('supabase/migrations').filter(name=>name.endsWith('.sql')).map(name=>name.split('_')[0]).filter(version=>version.length===14&&[...version].every(char=>char>='0'&&char<='9')).sort()
 const latest=migrations.at(-1)
 assert.ok(latest,'Expected at least one versioned migration')
 assert.match(baseline,new RegExp("EXPECTED_DB_MIGRATION_VERSION='"+latest+"'"))
 assert.ok(preflight.includes("WHERE version='"+latest+"'"),'Preflight must require latest SQL migration')
 assert.match(sqlGate,/has_function_privilege\('anon'/)
 assert.match(sqlGate,/has_function_privilege\('authenticated'/)
})
