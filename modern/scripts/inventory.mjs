#!/usr/bin/env node
// Read-only gap analysis. A candidate that runs cannot be called feature-complete
// until every operational route, API and security action passes the parity gate.
import {readdir,readFile} from "node:fs/promises"
import {relative,resolve,join} from "node:path"
const repo=resolve(import.meta.dirname,"../..")
const app=join(repo,"app")
async function allFiles(dir){
 const entries=await readdir(dir,{withFileTypes:true})
 const result=[]
 for(const entry of entries){
  const path=join(dir,entry.name)
  if(entry.isDirectory())result.push(...await allFiles(path))
  else if(entry.isFile())result.push(relative(repo,path).replaceAll("\\","/"))
 }
 return result
}
const files=await allFiles(app)
const pages=files.filter(x=>/\/page\.tsx?$/.test(x))
const api=files.filter(x=>/\/route\.tsx?$/.test(x))
const main=await readFile(join(repo,"modern/src/main.tsx"),"utf8")
const ported=[
 "/","/login","/events","/tasks","/chat",
 "/portals","/portals/administration","/portals/administration/finance","/portals/promotion",
]
const critical=["god","admin","finance","bank","oauth","integrations","auth","sales","checkin","payment","qr","timesheets","sign","push","scan","worker"]
const criticalFiles=[...pages,...api].filter(x=>critical.some(k=>x.toLowerCase().includes(k)))
const report={
 migrationReady:false,
 existing:{pages:pages.length,api:api.length},
 pilot:{portedRoutes:ported.length,readOnly:true,securedWritesMigrated:0},
 criticalRoutesPending:criticalFiles.length,
 productionCutoverAllowed:false,
}
if(!main.includes('path="*" element={<Missing/>}'))throw Error("Unported routes must fail clearly")
if(!main.includes('path="/god/*" element={<Missing/>}'))throw Error("Maker must not be implicitly migrated")
console.log(JSON.stringify(report,null,2))
if(process.argv.includes("--enforce-parity")){
 console.error("Cutover blocked: full route and transactional security parity not yet implemented")
 process.exitCode=1
}
