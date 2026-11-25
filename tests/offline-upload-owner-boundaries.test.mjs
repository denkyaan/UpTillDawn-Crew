
import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
test("the shared original offline upload queue rechecks ownership at every awaited upload boundary",()=>{
 const source=readFileSync("lib/crew-queue.ts","utf8")
 assert.ok(source.includes("ensureOfflineReplayOwner(userId,upload.userId,'uploads')"))
 assert.ok(source.includes("await verifyUploadOwner(s,userId);const {error}=await s.storage"))
 assert.ok(source.includes("await verifyUploadOwner(s,userId);const slash="))
 assert.ok(source.includes("await verifyUploadOwner(s,userId);\nconst {data:scanStatus"))
 for(const rpc of ["upt_attach_incident_photo","upt_send_chat_photo_message_operation_v2"])
  assert.ok(source.includes("await ensureUploaded(upload,s,userId);await verifyUploadOwner(s,userId);const {error}=await s.rpc('"+rpc+"'"))
 assert.ok(source.includes("error.message==='UPLOAD_SESSION_MISMATCH')throw error"))
})
