import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const file=async path=>readFile(new URL('../'+path,import.meta.url),'utf8')
test('God Mode has one Maker dashboard covering main and production with a single top-level navigation',async()=>{
 const [studio,overview,page,env]=await Promise.all([
  file('components/god-mode/god-studio.tsx'),
  file('components/god-mode/maker-overview.tsx'),
  file('app/god-mode/page.tsx'),
  file('lib/god-mode-environments.ts'),
 ])
 assert.match(studio,/useState<Tab>\('overview'\)/)
 for(const item of ['overview','recovery','studio','release','advanced'])assert.match(studio,new RegExp(item+':\\['))
 for(const item of ['MakerOverview','MakerLogs','GodVisualBuilder','GodSqlEditor'])assert.ok(studio.includes(item))
 assert.match(studio,/setEnvironment\(target\)/)
 assert.match(studio,/environment===('main'|'production')/)
 assert.match(overview,/environment='\+environment/)
 assert.doesNotMatch(page,/Object\.values\(GOD_ENVIRONMENTS\)/)
 assert.match(studio,/GOD_ENVIRONMENTS\[environment\]\.origin\+'\/god-mode'/)
 assert.match(env,/uptilldawn-main\.uptilldawn\.workers\.dev/)
 assert.match(env,/crew\.uptilldawn\.workers\.dev/)
})
test('main and production have their own CI and deploy workflow names',async()=>{
 const [overview,release,ci]=await Promise.all([
  file('app/api/god/overview/route.ts'),
  file('app/api/god/source/route.ts'),
  file('.github/workflows/fast-change-validation.yml'),
 ])
 for(const name of ['fast-change-validation.yml','deploy-main.yml','ci.yml','deploy-cloudflare.yml'])assert.ok(overview.includes(name))
 assert.ok(overview.includes("type Target='main'|'production'"))
 assert.match(overview,/deployedSha/)
 assert.match(release,/fast-change-validation\.yml\/runs\?head_sha=/)
 assert.match(release,/latest\.conclusion !== 'success'/)
 assert.doesNotMatch(release,/workflows\/ci\.yml\/runs\?head_sha=/)
 assert.match(ci,/name: CI main/)
})
test('cross-environment diagnostics remain read-only while SQL writes require the authenticated target',async()=>{
 const [logs,sql,editor,server]=await Promise.all([
  file('app/api/god/logs/route.ts'),
  file('app/api/god/sql/route.ts'),
  file('components/god-mode/god-sql-editor.tsx'),
  file('lib/god-studio-server.ts'),
 ])
 assert.match(logs,/authorizeStudio\(request\)/)
 assert.match(logs,/upt_god_database_secret/)
 assert.match(logs,/read_only:true/)
 assert.match(logs,/GOD_ENVIRONMENTS\[target\]\.supabaseProject/)
 assert.doesNotMatch(logs,/service_role/)
 assert.match(sql,/requiredGodEnvironment/)
 assert.match(sql,/body\.write&&target!==project\.id/)
 assert.match(sql,/project\.id==='production'&&body\.productionConfirmation/)
 assert.match(sql,/read_only:readOnly/)
 assert.match(editor,/productionConfirmation!=='PRODUCTION'/)
 assert.match(server,/upt_god_session_valid/)
})

test('Maker log and overview endpoints never claim a successful check when the source is unavailable',async()=>{
 const [api,logs,ui]=await Promise.all([
  file('app/api/god/overview/route.ts'),
  file('components/god-mode/maker-logs.tsx'),
  file('components/god-mode/maker-overview.tsx'),
 ])
 assert.match(api,/Promise\.allSettled/)
 assert.match(api,/reports:null|reports=.+null|let reports:.*null=null/)
 assert.match(logs,/if\(!response\.ok\)throw/)
 assert.match(logs,/setError\(true\)/)
 assert.match(ui,/t\.unknown/)
 assert.match(ui,/state\?\.reports/)
})
