// Candidate-only source contract inventory; offline and credential-free.
// This checks that every referenced RPC was explicitly audited. It does NOT
// claim a live project has matching functions or approve a production cutover.
import {readdirSync,readFileSync} from "node:fs"
import {resolve,join} from "node:path"

const root=resolve(import.meta.dirname,"..")
const source=join(root,"src")
const reference=JSON.parse(readFileSync(join(root,"scripts/rpc-reference.json"),"utf8"))
function sourceFiles(directory){
 return readdirSync(directory,{withFileTypes:true}).flatMap(item=>{
  const path=join(directory,item.name)
  return item.isDirectory()?sourceFiles(path):/\.tsx?$/.test(item.name)?[path]:[]
 })
}
const found=new Map()
for(const file of sourceFiles(source)){
 const content=readFileSync(file,"utf8")
 // Only the vetted static native admin action table is allowed to add
 // literal RPC selectors. No dynamic/caller-provided SQL function strings.
 const selectors=[
  /\.rpc\s*\(\s*["'](upt_[a-z0-9_]+)["']/g,
  ...(["native-admin-actions.ts","native-platform-actions.ts","native-event-shift-actions.ts","native-inventory-checklist-actions.ts","native-roster-handover-actions.ts","native-catalog-event-actions.ts"].some(name=>file.endsWith(name))?
   [/\brpc\s*:\s*["'](upt_[a-z0-9_]+)["']/g]:[])
 ]
 for(const selector of selectors)for(const match of content.matchAll(selector)){
  const list=found.get(match[1])||[]
  list.push(file.slice(source.length+1))
  found.set(match[1],list)
 }
}
const expected=new Set(reference.requiredPublicRpcNames)
const unreviewed=[...found.keys()].filter(name=>!expected.has(name)).sort()
const missingInSource=[...expected].filter(name=>!found.has(name)).sort()
const missingProduction=reference.lastObserved.production.missing||[]
const productionCutoverAllowed=false // Full live database + 7-role parity remains blocked.
console.log(JSON.stringify({
  sourceRpcCount:found.size,unreviewedRpc:unreviewed,
  noLongerReferenced:missingInSource,
  lastObservedProductionMissing:missingProduction,
  lastObservedAt:reference.lastObserved.checkedOn,
  liveDatabaseVerifiedInCi:false,productionCutoverAllowed
},null,2))
if(unreviewed.length||missingInSource.length)process.exitCode=1
// Deliberately refuses any attempt to use this static check as release approval.
if(process.argv.includes("--release")){console.error("CUTOVER BLOCKED: live target DB proof and full authenticated E2E are required.");process.exitCode=1}
