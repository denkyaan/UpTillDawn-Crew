import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const read=file=>readFileSync(file,"utf8")

test("original Main /shifts redirects approved signed users to /workplaces",()=>{
 const original=read("app/(app)/shifts/page.tsx")
 assert.ok(original.includes('getCurrentUser()'))
 assert.ok(original.includes('if(!current)return null'))
 assert.ok(original.includes("redirect('/workplaces')"))
})
test("Vite original-source runtime preserves the same URL without relaxing auth or replacing UI",()=>{
 const candidate=read("modern/src/screens/original-application.tsx")
 assert.ok(candidate.includes("if(location.pathname==='/shifts'&&auth.user)"),"only signed users may use the original shifts alias")
 assert.ok(candidate.indexOf("if(auth.loading)return <Loading/>")<
  candidate.indexOf("if(location.pathname==='/shifts'&&auth.user)"),"wait for authoritative signed session first")
 assert.ok(candidate.indexOf('return <Navigate to="/workplaces" replace/>')<
  candidate.indexOf('return <OriginalRequest key={identityKey}'),"redirect must occur before suspended original Main layout")
 assert.ok(candidate.includes('node=<AppLayout>{node}</AppLayout>'),"workplaces still enforces original Main auth/RLS")
 assert.ok(candidate.includes('<Navigate to="/workplaces" replace/>'))
 assert.ok(candidate.includes("if(auth.loading)return <Loading/>"))
 assert.ok(candidate.includes("path={path} element={node}"))
 assert.ok(candidate.includes("const pages=routes.map("),"reuse original Main page sources")
 assert.ok(!candidate.includes('to="/modern"'))
})
test("deep acceptance validates final original redirect and still fails on mismatched paths",()=>{
 const qa=read("modern/tests/deep-route-parity-qa.mjs")
 assert.ok(qa.includes("'/workplaces','/shifts','/briefings'"))
 assert.ok(qa.includes("const expectedPath=new URL(a.url()).pathname"))
 assert.ok(qa.includes("b.waitForURL(url=>url.pathname===expectedPath"))
 assert.ok(qa.includes("DEEP_PARITY_MISMATCH"))
 assert.ok(qa.includes("DEEP_PARITY_ALL_MISMATCHES"),"Report all route differences in one run")
 assert.ok(qa.includes("throw Error('DEEP_PARITY_MISMATCHES"),"Hard fail on any discrepancy")
 assert.ok(qa.includes("fullFunctionalParityVerified:false"))
 assert.ok(qa.includes("mainCutoverAllowed:false"))
})
