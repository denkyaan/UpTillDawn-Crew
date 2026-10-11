import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import vm from 'node:vm'
import ts from 'typescript'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')
const text=await read('lib/training-exercise-catalog.ts')
const js=ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const context={exports:{},require(){throw new Error('No runtime dependencies')}}
vm.runInNewContext(js,context)
const ops=context.exports.getTrainingOperations

test('inventory tour is a real role-specific stock and opening/closing workflow',async()=>{
 const [route,app,bot]=await Promise.all([
  read('app/(app)/inventory/page.tsx'),
  read('components/training/sandbox-inventory-training.tsx'),
  read('scripts/15-bot-browser-test.mjs')
 ])
 assert.match(route,/<SandboxInventoryTraining role=\{current\.role\}\/>/)
 assert.doesNotMatch(route,/import \{ SandboxInventory \}/)
 const counts={admin:23,responsible_lead:16,employee:13}
 for(const [role,count] of Object.entries(counts)){
  const actions=ops(role,'inventory')
  assert.equal(actions.length,count)
  for(const act of actions)for(const l of ['nl','fr','en','de'])assert.ok(act.title[l]?.trim())
 }
 assert.match(app,/getTrainingOperations\(trainingRole,"inventory"\)/)
 assert.match(app,/data-demo-inventory-operation=\{current\.id\}/)
 assert.match(app,/data-demo-inventory-preview=\{current\.id\}/)
 assert.match(app,/data-demo-inventory-detail=\{current\.id\}/)
 assert.match(app,/openedInspection!==current\.id/)
 assert.match(bot,/Inventory inspection completed without opening details/)
 assert.match(app,/data-training-practical-op=\{current\.id\}/)
 assert.match(app,/data-demo-inventory-category/)
 assert.match(app,/data-demo-inventory-select/)
 assert.match(app,/options\(\)\.some\(option=>option\.id===selected\)/)
 assert.match(bot,/Invalid inventory quantity advanced the tour/)
 assert.match(app,/data-demo-inventory-input/)
 assert.match(app,/else next\.quantity=n/)
 assert.match(app,/next\.opening=true/)
 assert.match(app,/next\.closing=true/)
 assert.match(app,/sessionStorage\.setItem\(key\(trainingRole\),JSON\.stringify\(next\)\)/)
 assert.match(bot,/const inventoryReal=chapter==='inventory'/)
 assert.match(bot,/inventory\.audit\?\.length!==total/)
 assert.match(bot,/inventory\.condition!=='damaged'/)
 assert.match(bot,/inventory\.quantity!==17/)
 assert.doesNotMatch(app,/createClient\(|supabase\.from\(|\.rpc\(|fetch\(/)
})

test('inventoried upload demonstrations never simulate unverified background malware scans',async()=>{
 const app=await read('components/training/sandbox-inventory-training.tsx')
 assert.match(app,/training-stock\.png/)
 assert.match(app,/training-equipment\.pdf/)
 assert.match(app,/current\.kind==="upload"/)
 assert.doesNotMatch(app,/scanCompleted|antivirusClean|malwareVerified|scanResult/)
})

test('role inventory workflows persist stock issues, returns, claim decisions and cancellations',async()=>{
 const [ui,bots]=await Promise.all([read('components/training/sandbox-inventory-training.tsx'),read('scripts/15-bot-browser-test.mjs')])
 for(const s of ['next.quantity-=1','next.quantity+=1','next.restocked=n','next.settlement="approved"','next.settlement="rejected"','next.settlement="cancelled"'])assert.ok(ui.includes(s),'missing '+s)
 assert.match(bots,/Staff cancellation altered stock/)
})
