import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const src=readFileSync(new URL("../lib/administration/contract-dispatch-readiness.ts",import.meta.url),"utf8")
test("dispatch gate requires approved immutable contract, matching digest, signer, envelope, and PDF",()=>{
 for(const field of ["identity","approval","digest","recipient","envelope","state","pdf"]){
  assert.match(src,new RegExp('blockers\\.push\\("'+field+'"\\)'))
 }
 assert.match(src,/ready:blockers\.length===0/)
})
test("dispatch gate performs no network call or signing delivery",()=>{
 assert.doesNotMatch(src,/\bfetch\s*\(|distributeContractSigningDraft\s*\(/)
})
