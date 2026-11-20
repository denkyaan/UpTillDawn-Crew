import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'

const migration=readFileSync('supabase/migrations/20261109091500_public_table_unsafe_privilege_revoke.sql','utf8')
const regression=readFileSync('tests/sql/public_table_unsafe_privileges.sql','utf8')

test('all ordinary and partitioned public tables lose unsafe RLS-bypassing privileges',()=>{
 assert.match(migration,/from pg_class c join pg_namespace n on n\.oid=c\.relnamespace/)
 assert.match(migration,/n\.nspname='public'/)
 assert.match(migration,/c\.relkind in \('r','p'\)/)
 assert.match(migration,/revoke truncate, references, trigger on table %I\.%I from public, anon, authenticated/i)
 assert.match(migration,/execute format\(/)
})

test('privilege hardening leaves normal RLS-governed DML untouched',()=>{
 assert.doesNotMatch(migration,/revoke (?:all|select|insert|update|delete)\b/i)
 assert.doesNotMatch(migration,/\b(?:delete\s+from|truncate\s+table|drop\s+table)\s+public\./i)
 assert.doesNotMatch(migration,/\b(?:disable|drop)\s+row\s+level\s+security/i)
 assert.doesNotMatch(migration,/\bgrant\s+all/i)
})

test('full SQL release gate validates all table permissions, not a small allowlist',()=>{
 assert.match(regression,/from pg_class c join pg_namespace n/)
 for(const op of ['TRUNCATE','TRIGGER','REFERENCES']){
  assert.match(regression,new RegExp("has_table_privilege\\('authenticated',c\\.oid,'"+op+"'\\)"))
  assert.match(regression,new RegExp("has_table_privilege\\('anon',c\\.oid,'"+op+"'\\)"))
 }
 assert.match(regression,/public\.admin_financial_attachments/)
 assert.match(regression,/public\.tasks/)
})
