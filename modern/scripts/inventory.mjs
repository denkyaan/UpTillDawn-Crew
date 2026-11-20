#!/usr/bin/env node
// A fail-closed, machine-readable parity inventory. Never assume a route
// migrated because the new SPA shows a heading or a static placeholder.
import {readdir,readFile} from "node:fs/promises"
import {pages as originalSourcePages,actionEntries} from "../tooling/main-source.mjs"
import {verifyOriginalActionRegistry} from "../tooling/action-registry-contract.mjs"
import {relative,resolve,join} from "node:path"

const repo=resolve(import.meta.dirname,"../..")
async function allFiles(dir){
 const entries=await readdir(dir,{withFileTypes:true})
 const output=[]
 for(const entry of entries){
  const file=join(dir,entry.name)
  if(entry.isDirectory())output.push(...await allFiles(file))
  else if(entry.isFile())output.push(relative(repo,file).replaceAll("\\","/"))
 }
 return output
}
function routeOf(file){
 const route=file.replace(/^app\//,"").split("/")
  .filter(segment=>!/^\([^)]*\)$/.test(segment))
  .slice(0,-1)
  .join("/")
 return "/"+route
}
const criticalWords=["god","admin","finance","bank","oauth","integrations","auth","sales","checkin","check-in","payment","qr","timesheet","sign","push","scan","worker","payroll"]
const files=await allFiles(join(repo,"app"))
const pages=files.filter(x=>/\/page\.tsx?$/.test(x))
const api=files.filter(x=>/\/route\.tsx?$/.test(x))
const libActions=(await allFiles(join(repo,"lib","actions"))).filter(x=>/\.(ts|tsx)$/.test(x))
let serverActions=0
for(const file of libActions){
 const s=await readFile(join(repo,file),"utf8")
 serverActions+=(s.match(/export\s+async\s+function\s+[A-Za-z_$][\w$]*/g)||[]).length
}
const sourceActionIds=actionEntries().map(entry=>entry.id)
const registrySource=await readFile(join(repo,"lib/migration/original-action-registry.ts"),"utf8")
const originalActions=verifyOriginalActionRegistry(sourceActionIds,registrySource)

const sourcePages=new Set([...originalSourcePages,...pages.filter(x=>x.startsWith('app/(auth)/')), 'app/auth/reset-password/page.tsx'])
// Count EVERY existing route and action as pending until individually verified
// in real role/browser and auth/RLS tests. No placeholder is marked complete.
const routes=[...pages.map(source=>({kind:"page",source,path:routeOf(source),status:sourcePages.has(source)?"source-reused-acceptance-pending":"unported"})),
 ...api.map(source=>({kind:"api",source,path:routeOf(source),status:"original-server-transport-acceptance-pending"}))]
routes.sort((a,b)=>a.path.localeCompare(b.path)||a.kind.localeCompare(b.kind))
const criticalRoutes=routes.filter(item=>criticalWords.some(k=>item.path.toLowerCase().includes(k)))
const main=await readFile(join(repo,"modern/src/screens/original-application.tsx"),"utf8")
const source=await readFile(join(repo,"modern/tooling/main-source.mjs"),"utf8")
if(!main.includes('main-source/routes')||!main.includes('<NotFound/>'))throw Error("Original source routes and explicit 404 required")
if(!source.includes("Private server module blocked"))throw Error("Private server code must fail closed")
const report={
 migrationReady:false,
 productionCutoverAllowed:false,
 existing:{pages:pages.length,api:api.length,serverActionExports:serverActions},
 sourceReuse:{pages:pages.filter(x=>sourcePages.has(x)).length,originalServerHandlers:api.length,originalActionsDispatched:originalActions.registeredCount,originalActionAcceptancePending:true},
 parity:{verifiedPages:0,verifiedApis:0,verifiedServerActions:0,pendingRoutes:routes.length,pendingServerActions:serverActions},
 criticalRoutesPending:criticalRoutes.length,
 ...(process.argv.includes("--routes")?{routes}:{}),
}
if(!pages.length||!api.length||serverActions<1)throw Error("Route/action discovery broken — refusing to claim a clean inventory")
console.log(JSON.stringify(report,null,2))
if(process.argv.includes("--enforce-parity")){
 console.error("Cutover blocked: all existing routes, actions and role security must reach verified parity")
 process.exitCode=1
}
