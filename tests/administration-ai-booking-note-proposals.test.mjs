import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const api=readFileSync("app/api/administration/assistant/booking-notes/propose/route.ts","utf8")
const ui=readFileSync("components/administration/administration-ai-booking-notes.tsx","utf8")
test("AI booking note proposal validates access and never writes",()=>{
 assert.match(api,/getCurrentUser\(\)/)
 assert.match(api,/canOpenPortal\("administration"/)
 assert.match(api,/booking\.status==="cancelled"/)
 assert.match(api,/\.strict\(\)\.safeParse\(JSON\.parse\(extracted\)\)/)
 assert.doesNotMatch(api,/\.update\(|\.insert\(|\.delete\(/)
 assert.match(api,/expectedNotes:booking\.internal_notes/)
})
test("AI note proposal requires review and separate explicit confirmation",()=>{
 assert.match(ui,/booking-notes\/propose/)
 assert.match(ui,/setNotes\(payload\.notes\)/)
 assert.match(ui,/payload\.expectedNotes!==booking\.internal_notes/)
 assert.match(ui,/confirmed:true/)
 assert.match(ui,/t\.preview/)
})
