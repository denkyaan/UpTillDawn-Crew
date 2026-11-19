import test from "node:test"
import assert from "node:assert/strict"
import {canRememberRoute,resolvePortalPreference} from "../src/shared/portal-preference.ts"

const uid="11111111-1111-4111-8111-111111111111"
const staff={userId:uid,role:"staff",isOwner:false,portals:["events"]}
const admin={...staff,role:"admin",portals:["events","administration","promotion"]}
const owner={...staff,isOwner:true,portals:["events","administration","promotion"]}

test("owner chooses normal app or God Mode at first login, then can resume",()=>{
 assert.equal(resolvePortalPreference(null,owner),null)
 assert.equal(resolvePortalPreference("/maker/diagnostics",owner),"/maker/diagnostics")
 assert.equal(resolvePortalPreference("/overview",owner),"/overview")
 assert.equal(resolvePortalPreference("/events",owner),"/events")
})
test("existing remembered portal is never permission or an open redirect",()=>{
 for(const malicious of ["//evil.example","https://evil.example","/god/deploy","/maker/diagnostics?token=x","/portals/administration/finance/../..","/unknown","/profile#secret","/events%2F.."])
  assert.equal(resolvePortalPreference(malicious,staff),"/overview")
 assert.equal(canRememberRoute("/maker/diagnostics",staff),false)
 assert.equal(resolvePortalPreference("/maker/diagnostics",staff),"/overview")
 assert.equal(resolvePortalPreference("/portals/administration/finance",staff),"/overview")
 assert.equal(resolvePortalPreference("/portals/promotion",staff),"/overview")
})
test("revoked portal preferences fall back safely at next validated session",()=>{
 assert.equal(resolvePortalPreference("/portals/administration",admin),"/portals/administration")
 assert.equal(resolvePortalPreference("/portals/administration/finance",admin),"/portals/administration/finance")
 assert.equal(resolvePortalPreference("/portals/promotion",admin),"/portals/promotion")
 assert.equal(resolvePortalPreference("/portals/administration",staff),"/overview")
 assert.equal(resolvePortalPreference("/responsible",staff),"/overview")
 assert.equal(resolvePortalPreference("/responsible",admin),"/responsible")
 assert.equal(resolvePortalPreference("/maker/diagnostics",{...owner,isOwner:false}),"/overview")
 assert.equal(resolvePortalPreference("/maker/diagnostics",{...owner,portals:[]}),"/maker/diagnostics")
})
test("non-privileged paths restore normally; event routes demand event portal",()=>{
 assert.equal(resolvePortalPreference(null,staff),"/overview")
 assert.equal(resolvePortalPreference("/profile",staff),"/profile")
 assert.equal(resolvePortalPreference("/notifications",staff),"/notifications")
 assert.equal(resolvePortalPreference("/qr",{...staff,portals:["promotion"]}),"/overview")
 assert.equal(resolvePortalPreference("/events",staff),"/events")
 assert.equal(resolvePortalPreference("/tasks",staff),"/tasks")
})

test("mode selector is localized in all four supported app languages",async()=>{
 const {copy,languages}=await import("../src/shared/i18n.ts")
 assert.deepEqual([...languages],["nl","fr","en","de"])
 for(const locale of languages){
  const labels=copy(locale)
  for(const key of ["choosePortal","normalApp","preferenceNote"])
   assert.ok(typeof labels[key]==="string"&&labels[key].length>3)
 }
})

test("operational navigation and deep links remain guarded by confirmed events portal",async()=>{
 const {readFileSync}=await import("node:fs")
 const main=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8")
 assert.ok(main.includes('const canEvents=state.portals.includes("events")'))
 assert.ok(main.includes('<Route element={<PortalGuard portal="events"><Outlet/></PortalGuard>}>'))
 for(const route of ["/events","/tasks","/chat","/crew","/briefings","/qr","/operations"])
  assert.ok(main.includes('path="'+route+'"'),route)
})
