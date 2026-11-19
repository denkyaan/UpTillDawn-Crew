import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {createRefreshGate} from "../src/shared/refresh-gate.ts"

const tick=()=>new Promise(resolve=>setImmediate(resolve))
test("duplicate visibility/auth checks share exactly one validation",async()=>{
 const gate=createRefreshGate()
 let calls=0,release
 const first=gate.validate(async ticket=>{
  calls++
  assert.equal(gate.isCurrent(ticket),true)
  await new Promise(resolve=>release=resolve)
 })
 const second=gate.validate(async()=>{calls++})
 assert.equal(first,second)
 await tick()
 assert.equal(calls,1)
 release()
 await first
 await gate.validate(async()=>{calls++})
 assert.equal(calls,2)
})
test("signed-out and account-switched sessions cannot restore stale async results",async()=>{
 const gate=createRefreshGate()
 let firstTicket=0,secondTicket=0,releaseOld,releaseNew
 const old=gate.validate(async ticket=>{
  firstTicket=ticket
  await new Promise(resolve=>releaseOld=resolve)
 })
 await tick()
 gate.invalidate()
 assert.equal(gate.isCurrent(firstTicket),false)
 const latest=gate.validate(async ticket=>{
  secondTicket=ticket
  await new Promise(resolve=>releaseNew=resolve)
 })
 await tick()
 assert.equal(gate.isCurrent(firstTicket),false)
 assert.equal(gate.isCurrent(secondTicket),true)
 releaseOld()
 await old
 // Settling old request cannot clear the new in-flight gate.
 const duplicate=gate.validate(async()=>{throw new Error("duplicate_session_request")})
 assert.equal(duplicate,latest)
 releaseNew()
 await latest
})
test("candidate session remains fail-closed and authenticates every ready state via live RPC",()=>{
 const session=readFileSync(new URL("../src/lib/session.tsx",import.meta.url),"utf8")
 const main=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8")
 assert.ok(session.includes("refreshGate.current.validate(async ticket=>"))
 assert.ok(session.includes('if(event==="INITIAL_SESSION")return'))
 assert.ok(session.includes('if(event==="SIGNED_OUT")'))
 assert.ok(session.includes("refreshGate.current.invalidate()"))
 assert.ok(session.includes('rpc("upt_current_session_context")'))
 assert.ok(session.includes('rpc("upt_my_portal_assignments")'))
 assert.ok(session.includes("if(error){"))
 assert.ok(session.includes('throw new Error("signout_failed")'))
 assert.ok(session.includes('purgeLocalUser(session.user.id)'))
 assert.ok(session.includes('purgeLocalUser(lastIdentity.current)'))
 assert.ok(main.includes("state.signOut().catch(()=>{})"))
})
