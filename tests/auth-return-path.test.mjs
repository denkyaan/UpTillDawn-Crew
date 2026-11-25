import test from "node:test"
import assert from "node:assert/strict"
import {safeAuthReturnPath} from "../lib/auth-return-path.ts"
test("email callback return locations reject ambiguous, external and normalized network paths",()=>{
 const origin="https://crew.uptilldawn.workers.dev"
 for(const value of [null,"https://foreign.invalid","//foreign.invalid","/\\foreign.invalid","/\t/foreign.invalid","/\n/foreign.invalid","/a/..//foreign.invalid","/a/%2e%2e//foreign.invalid"])
  assert.equal(safeAuthReturnPath(value,origin),"/")
 for(const value of ["/","/events","/auth/reset-password","/events?q=a%20b#details"])
  assert.equal(safeAuthReturnPath(value,origin),value)
})
