import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')

test('Maker environment selector keeps test and production Supabase sessions isolated',async()=>{
 const [config,page,studio]=await Promise.all([
  read('lib/god-mode-environments.ts'),read('app/god-mode/page.tsx'),
  read('components/god-mode/god-studio.tsx'),
 ])
 assert.match(config,/npbjrtiolqperdgljnhi/)
 assert.match(config,/eakoavcieossazqzplke/)
 assert.match(config,/uptilldawn-main\.uptilldawn\.workers\.dev/)
 assert.match(config,/crew\.uptilldawn\.workers\.dev/)
 assert.match(page,/upt_god_session_valid/)
 assert.match(page,/GodStudio/)
 assert.match(page,/requiredGodEnvironment/)
 assert.match(page,/item\.origin\+'\/god-mode'/)
 assert.match(studio,/environment!==localEnvironment/)
 assert.match(studio,/GOD_ENVIRONMENTS\[environment\]\.origin/)
 assert.match(studio,/MakerOverview/)
 assert.match(studio,/MakerLogs/)
})
test('Every SQL operation is bound to the active Supabase project',async()=>{
 const [route,editor]=await Promise.all([
  read('app/api/god/sql/route.ts'),read('components/god-mode/god-sql-editor.tsx'),
 ])
 assert.match(route,/main:'npbjrtiolqperdgljnhi'/)
 assert.match(route,/production:'eakoavcieossazqzplke'/)
 assert.match(route,/PROJECTS\[target\]/)
 assert.match(route,/body\.environment==='production'&&body\.write/)
 assert.match(route,/read_only:readOnly/)
 assert.match(editor,/disabled=\{inProduction\}/)
 assert.match(editor,/write:write&&!inProduction/)
 
})
test('Cross-environment logs stay read only and never forward a different Supabase JWT',async()=>{
 const route=await read('app/api/god/logs/route.ts')
 assert.match(route,/authorizeStudio/)
 assert.match(route,/upt_god_maker_log_snapshot/)
 assert.match(route,/GOD_ENVIRONMENTS\[target\]\.supabaseProject/)
 assert.match(route,/read_only:true/)
 assert.match(route,/upt_god_database_secret/)
 assert.doesNotMatch(route,/SUPABASE_SERVICE_ROLE_KEY/)
 assert.doesNotMatch(route,/\/auth\/v1\/user/)
})
test('God Mode change publication validates exact CI main PR SHA, not production CI',async()=>{
 const source=await read('app/api/god/source/route.ts')
 assert.match(source,/fast-change-validation\.yml/)
 assert.match(source,/head_sha === body\.sha/)
 assert.match(source,/head_branch === pull\.head\.ref/)
 assert.match(source,/event === 'pull_request'/)
 assert.doesNotMatch(source,/\/actions\/workflows\/ci\.yml\/runs/)
 assert.match(source,/Cloudflare|main-test/)
})
