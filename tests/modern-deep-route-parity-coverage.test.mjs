import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {pages,routePath} from "../modern/tooling/main-source.mjs"
const read=path=>readFileSync(path,"utf8")
const deep=read("modern/tests/deep-route-parity-qa.mjs")
const workflow=read(".github/workflows/deploy-main.yml")
const fast=read(".github/workflows/fast-change-validation.yml")

test("22 deep authenticated routes exist in the authoritative original Main, not placeholders",()=>{
 const paths=[
  "/admin/management","/admin/time-records",
  "/portals/administration/modules/invoices","/portals/administration/modules/banking",
  "/portals/administration/modules/ticketing",
  "/portals/administration/rosters","/portals/administration/modules/contracts",
  "/portals/administration/personnel","/portals/administration/modules/inventory",
  "/portals/administration/finance","/portals/administration/modules/artists",
  "/portals/administration/timesheets",
  "/workplaces","/shifts","/briefings","/tasks","/timesheets","/notifications",
  "/portals/promotion/tasks","/portals/promotion/chats","/portals/promotion/notifications"
 ]
 const allPaths=new Set(pages.map(routePath))
 assert.equal(paths.length,21)
 for(const path of paths){
  assert.ok(allPaths.has(path),"Original Main route missing: "+path)
  assert.ok(deep.includes("'"+path+"'"),"Uncovered deep comparison: "+path)
 }
 assert.ok(deep.includes("EXPECTED!==22"),"22 actual role-route cases required")
 for(const role of ["head_admin","left_hand","right_hand","administration","responsible","staff","promotion"])
  assert.ok(deep.includes("role:'"+role+"'"),"Role missing from deep browser QA: "+role)
})
test("deep acceptance runs against live Main and modern Worker, no business form submissions",()=>{
 assert.ok(deep.includes("await a.goto(original+path"))
 assert.ok(deep.includes("await b.goto(modern+path"))
 assert.ok(deep.includes("await login.waitForURL(url=>!url.pathname.startsWith('/login')"))
 const click=deep.indexOf("await login.locator('form button[type=\"submit\"]').click()")
 const redirect=deep.indexOf("await login.waitForURL(url=>!url.pathname.startsWith('/login')")
 const hydration=deep.indexOf("await ready(login)")
 assert.ok(click>=0&&click<redirect&&redirect<hydration,"Native auth redirect must complete before evaluating the logged-in shell")
 assert.ok(deep.includes("await matching(a,b,name)"))
 assert.ok(deep.includes("if(signins!==7||validated!==EXPECTED)"))
 assert.ok(deep.includes("DEEP_PARITY_RENDER_ERROR"))
 assert.ok(deep.includes("DEEP_PARITY_MISMATCH"))
 assert.ok(deep.includes("fullFunctionalParityVerified:false"))
 assert.ok(deep.includes("mainCutoverAllowed:false"))
 assert.ok(!deep.includes("waitForLoadState('networkidle'"))
 assert.ok(!deep.includes("waitUntil:'networkidle'"))
 assert.ok(!deep.includes("uptilldawn-chat-read"))
 assert.ok(!deep.includes("upt-source-refresh"))
 assert.ok(!deep.includes("form.submit()"))
 assert.ok(!deep.includes("VITE_MIGRATION_ALLOW_WRITES='true'"))
})
test("deployment fails closed on live deep comparisons after existing login, roles and 30-session checks",()=>{
 const steps=[
  "Compare original Main login — 48 screens and 160 interaction states",
  "Verify seven real roles, four languages and two devices on LIVE modern Worker",
  "Exercise 30 DISTINCT signed QA sessions through deployed Hono /api/v1/session",
  "Compare 22 deep original pages across seven real QA roles before any cutover"
 ]
 const positions=steps.map(step=>workflow.indexOf("- name: "+step))
 assert.ok(positions.every(i=>i>=0),"Live QA step missing")
 assert.deepEqual([...positions].sort((a,b)=>a-b),positions,"Live deep QA must follow original gates")
 assert.ok(workflow.includes("npm --prefix modern run browser:deep-qa"))
 assert.ok(workflow.includes("name: modern-main-deep-route-differences"))
 assert.ok(fast.includes("node --check modern/tests/deep-route-parity-qa.mjs"))
 assert.equal(JSON.parse(read("modern/package.json")).scripts["browser:deep-qa"],"node tests/deep-route-parity-qa.mjs")
})
