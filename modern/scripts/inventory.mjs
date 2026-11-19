#!/usr/bin/env node
// A fail-closed, machine-readable parity inventory. Never assume a route
// migrated because the new SPA shows a heading or a static placeholder.
import {readdir,readFile} from "node:fs/promises"
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
// Candidate screens are not production-parity even when their source builds.
const pilots=new Map(Object.entries({
 "/":"dashboard-candidate",
 "/login":"auth-candidate",
 "/events":"RLS-read-plus-guarded-availability-write",
 "/tasks":"RLS-read-plus-guarded-task-writes",
 "/chat":"RLS-read-Realtime-plus-guarded-text-outbox",
 "/portals":"portal-navigation-candidate",
 "/portals/administration":"RLS-documents-payments-inventory-read",
 "/portals/administration/finance":"financial-summary-read-only",
 "/portals/promotion":"RLS-promotion-task-list-only",
 "/crew":"RLS-personal-shifts-checkins-timesheets-read",
 "/briefings":"RLS-briefings-plus-disabled-acknowledgement",
 "/operations":"RLS-workplace-inventory-incident-read",
 "/responsible":"RLS-assignment-scoped-roster-read",
 "/notifications":"RLS-user-notifications-read",
 "/profile":"RLS-user-minimal-profile-read",
 "/qr":"QR-state-machine-with-disabled-transactional-requests",
 "/maker/diagnostics":"owner-only-summarized-manual-read-not-full-God-Mode",
}))
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
// Count EVERY existing route and action as pending until individually verified
// in real role/browser and auth/RLS tests. No placeholder is marked complete.
const routes=[...pages.map(source=>({kind:"page",source,path:routeOf(source),status:pilots.has(routeOf(source))?"candidate-not-parity":"unported"})),
 ...api.map(source=>({kind:"api",source,path:routeOf(source),status:"unported"}))]
routes.sort((a,b)=>a.path.localeCompare(b.path)||a.kind.localeCompare(b.kind))
const criticalRoutes=routes.filter(item=>criticalWords.some(k=>item.path.toLowerCase().includes(k)))
const main=await readFile(join(repo,"modern/src/main.tsx"),"utf8")
if(!main.includes('path="*" element={<Missing/>}'))throw Error("Unported routes must fail clearly")
if(!main.includes('path="/god/*" element={<Missing/>}'))throw Error("Maker must not be implicitly migrated")
if(!main.includes('path="/portals/administration/finance"'))throw Error("Finance candidate route missing")
const report={
 migrationReady:false,
 productionCutoverAllowed:false,
 existing:{pages:pages.length,api:api.length,serverActionExports:serverActions},
 pilot:{portedRoutes:pilots.size,readOnly:true,securedWritesMigrated:0,guardedWritesPresent:true,guardedWritesEnabled:false},
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
