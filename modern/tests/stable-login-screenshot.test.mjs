import test from "node:test"
import assert from "node:assert/strict"
import {stableLoginScreenshot} from "../tooling/stable-login-screenshot.mjs"
function pageWith(frames){
 const calls=[]
 const page={
  async bringToFront(){calls.push("activate")},
  async evaluate(){calls.push("settle")},
  async screenshot(options){calls.push("screenshot")
   assert.deepEqual(options,{fullPage:true,animations:"disabled",caret:"hide"})
   return Buffer.from(frames.shift())
  }
 }
 return {page,calls}
}
test("anonymous login capture requires two consecutive identical full frames",async()=>{
 const {page,calls}=pageWith(["edge-a","edge-b","edge-b"])
 const result=await stableLoginScreenshot(page)
 assert.equal(result.stable,true)
 assert.equal(result.captures,3)
 assert.equal(result.pixels.toString(),"edge-b")
 assert.deepEqual(calls,["activate","settle","screenshot","settle","screenshot","settle","screenshot"])
})
test("four changing frames never pass, even if an earlier frame repeats",async()=>{
 const {page}=pageWith(["a","b","a","c"])
 const result=await stableLoginScreenshot(page)
 assert.equal(result.stable,false)
 assert.equal(result.captures,4)
 assert.equal(result.pixels.toString(),"c")
})
test("different stable captures remain unequal without any tolerance",async()=>{
 const a=await stableLoginScreenshot(pageWith(["edge-a","edge-a"]).page)
 const b=await stableLoginScreenshot(pageWith(["edge-b","edge-b"]).page)
 assert.equal(a.stable&&b.stable,true)
 assert.equal(a.pixels.equals(b.pixels),false)
})
