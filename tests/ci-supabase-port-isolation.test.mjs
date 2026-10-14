import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')

test('CI isolates its Supabase ports instead of assuming fixed host port 54322',async()=>{
 const workflow=await read('.github/workflows/ci.yml')
 const script=await read('scripts/configure-isolated-supabase-ci.py')
 assert.match(workflow,/Assign conflict-free isolated Supabase ports/)
 assert.match(workflow,/python3 scripts\/configure-isolated-supabase-ci\.py/)
 assert.match(workflow,/PGURL="\$CI_SUPABASE_DB_URL"/)
 assert.match(workflow,/BOT_DB_URL=\$CI_SUPABASE_DB_URL/)
 assert.doesNotMatch(workflow,/127\.0\.0\.1:54322\/postgres/)
 assert.match(script,/probe\.bind\(\("0\.0\.0\.0", 0\)\)/)
 assert.match(script,/config_path\.write_text\(source/)
 assert.match(script,/CI_SUPABASE_DB_URL=/)
 for(const part of ['("api", "port")','("db", "port")','("db", "shadow_port")']){
  assert.ok(script.includes(part),'missing remap for '+part)
 }
 assert.match(script,/tomllib\.loads\(source\)/)
})
