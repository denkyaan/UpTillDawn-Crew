// Rehearsal only. No remote DSN, migration-history writes or commit path.
// Reapply the exact candidate alignment migrations to the already replayed
// disposable schema. This tests repeatability, NOT divergent live DB repair.
import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {resolve} from 'node:path'
const root=resolve(import.meta.dirname,'../..')
const pg='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
assert.equal(process.env.BOT_DB_URL,pg)
assert.equal(process.env.BOT_SUPABASE_URL,'http://127.0.0.1:54321')
const manifest=JSON.parse(readFileSync(resolve(root,'scripts/phase23-environment-alignment.json'),'utf8'))
const preflight=readFileSync(resolve(root,'scripts/production-preflight-readonly.sql'),'utf8')
const psql=input=>execFileSync('psql',[pg,'-X','-v','ON_ERROR_STOP=1','-At','-F','|'],{input,encoding:'utf8',timeout:45000,maxBuffer:4*1024*1024})
const rows=value=>value.split('\n').filter(x=>/^[a-z_]+\|[tf]\|[tf]\|/.test(x)).map(x=>{const [name,required,passed]=x.split('|');return {name,required:required==='t',passed:passed==='t'}})
const required=value=>{const checks=rows(value).filter(x=>x.required);assert.equal(checks.length,24);assert.ok(checks.every(x=>x.passed),'ALIGNMENT_REQUIRED_CHECK_FAILED');return checks}
const before=required(psql('BEGIN READ ONLY;\n'+preflight+'\nROLLBACK;'))
const report={validatedSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),runId:process.env.GITHUB_RUN_ID||null,runAttempt:process.env.GITHUB_RUN_ATTEMPT||null,scope:'disposable-replay-only',environments:{},failures:[],liveDatabaseChanged:false,productionCompatibilityVerified:false}
for(const [name,target] of Object.entries({main:manifest.main,production:manifest.production})){
 try{
  assert.equal(new Set(target.migrations).size,target.migrations.length)
  assert.deepEqual(target.migrations,[...target.migrations].sort())
  const files=target.migrations.map(file=>{
   assert.match(file,/^\d{14}_[a-z0-9_]+\.sql$/)
   const sql=readFileSync(resolve(root,'supabase/migrations',file),'utf8')
   assert.doesNotMatch(sql,/^\s*(?:COMMIT|ROLLBACK|BEGIN\s+(?:TRANSACTION|WORK))\s*;/im)
   return {file,sql,sha256:createHash('sha256').update(sql).digest('hex')}
  })
  const result=required(psql('BEGIN;\nSET LOCAL lock_timeout=\'5s\';\nSET LOCAL statement_timeout=\'20s\';\n'+files.map(f=>f.sql).join('\n')+'\n'+preflight+'\nROLLBACK;'))
  assert.deepEqual(result,before)
  assert.deepEqual(required(psql('BEGIN READ ONLY;\n'+preflight+'\nROLLBACK;')),before)
  report.environments[name]={outcome:'pass',requiredChecks:24,transactionRolledBack:true,migrations:files.map(({file,sha256})=>({file,sha256})),liveVerified:false}
  console.log('PASS local alignment replay '+name+' '+files.length+' migrations; 24 checks; rolled back')
 }catch(error){report.failures.push({name,reason:error.name});console.error('FAIL local alignment replay '+name+' '+error.name)}
}
const dir=resolve(root,'test-results/phase-two-three-local-native')
mkdirSync(dir,{recursive:true})
writeFileSync(resolve(dir,'alignment-rehearsal.json'),JSON.stringify(report,null,2)+'\n')
if(report.failures.length)process.exitCode=1
