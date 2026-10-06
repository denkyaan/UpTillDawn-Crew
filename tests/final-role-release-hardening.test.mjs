import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')

test('automation configuration is owner-only at API and database boundaries',async()=>{
 const [route,sql]=await Promise.all([read('app/api/god/automation-rules/route.ts'),read('supabase/migrations/20260930231500_god_only_automation_configuration.sql')])
 assert.match(route,/upt_current_is_owner/)
 assert.match(route,/Alleen de maker kan automatiseringen beheren/)
 assert.match(sql,/not public\.upt_current_is_owner\(\)/)
 assert.doesNotMatch(sql,/not public\.upt_is_admin\(v_actor\)/)
 assert.match(sql,/automation_rules_owner_select/)
})

test('role-specific operational automation copy has four-language runtime coverage',async()=>{
 const catalog=await read('lib/ui-translation-catalog-app-extra.ts')
 const values=['Open incident op jouw werkplek','Taak vraagt opvolging','Een taak op jouw werkplek is te laat.','Werkplekoverdracht wacht op jou','Een klaargezette overdracht wacht nog op jouw acceptatie.','Je hebt een open taak','Bekijk je open taak.','Briefing nog bevestigen','Lees en bevestig je verplichte briefing vóór je shift.']
 for(const value of values){
  const line=catalog.split('\n').find(row=>row.includes('\"'+value+'\"'))
  assert.ok(line,value)
  for(const locale of ['fr:','en:','de:']) assert.ok(line.includes(locale),value+' '+locale)
 }
})

test('production web deploy does not falsely claim to apply Supabase migrations',async()=>{
 const deploy=await read('.github/workflows/deploy-cloudflare.yml')
 assert.doesNotMatch(deploy,/supabase\s+db\s+push|migration\s+up/)
 assert.match(deploy,/Deploy production Worker/)
})
