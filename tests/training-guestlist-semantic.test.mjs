import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import vm from 'node:vm'
import ts from 'typescript'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')
const catalog=await read('lib/training-exercise-catalog.ts')
const js=ts.transpileModule(catalog,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const sandbox={exports:{},require(){throw new Error('Unexpected catalog dependency')}}
vm.runInNewContext(js,sandbox)

test('guestlist walkthrough teaches actual search, artist check-in, Backstage alerts and admin import',async()=>{
 const [page,view,bot]=await Promise.all([
  read('app/(app)/guestlist/page.tsx'),
  read('components/training/sandbox-guestlist-training.tsx'),
  read('scripts/15-bot-browser-test.mjs')
 ])
 assert.match(page,/<SandboxGuestlistTraining role=\{current\.role\}\/>/)
 assert.doesNotMatch(page,/import \{ SandboxGuestlist \}/)
 const counts={admin:14,responsible_lead:9,employee:9}
 for(const [role,count] of Object.entries(counts)){
  const actions=sandbox.exports.getTrainingOperations(role,'guestlist')
  assert.equal(actions.length,count,role)
  for(const action of actions)for(const language of ['nl','fr','en','de'])assert.ok(action.title[language]?.trim())
 }
 assert.match(view,/getTrainingOperations\(trainingRole,"guestlist"\)/)
 assert.match(view,/data-demo-guestlist-operation=\{current\.id\}/)
 assert.match(view,/data-training-practical-op=\{current\.id\}/)
 assert.match(view,/if\(!next\.search\|\|next\.filter!=="artist"\)return fail\(\)/)
 assert.match(view,/next\.arrived=true;next\.backstage=true/)
 assert.match(view,/next\.duplicatesReviewed=true/)
 assert.match(view,/next\.importFile=value/)
 assert.match(view,/sessionStorage\.setItem\(key\(trainingRole\),JSON\.stringify\(next\)\)/)
 assert.match(bot,/const guestlistReal=chapter==='guestlist'/)
 assert.match(bot,/guestlist\.audit\?\.length!==total/)
 assert.match(bot,/guestlist\.filter!=='artist'/)
 assert.match(bot,/guestlist\.duplicatesReviewed/)
 assert.doesNotMatch(view,/createClient\(|supabase\.from\(|\.rpc\(|fetch\(/)
})
