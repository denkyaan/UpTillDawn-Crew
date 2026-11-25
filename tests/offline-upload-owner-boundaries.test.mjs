
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

import {ensureOfflineUploadPath} from "../lib/offline-sync-policy.ts"
test("offline upload must match exact authenticated owner, operation UUID and extension",()=>{
 const u="00000000-0000-4000-8000-000000000001",id="00000000-0000-4000-8000-000000000002"
 assert.doesNotThrow(()=>ensureOfflineUploadPath(u,id,u+"/"+id+".jpg","jpg"))
 for(const path of [id+"/"+id+".jpg",u+"/../"+id+".jpg",u+"/"+id+".pdf",u+"//"+id+".jpg",u+"/"+id+".jpg?x=1"])
  assert.throws(()=>ensureOfflineUploadPath(u,id,path,"jpg"),/UPLOAD_PATH_MISMATCH/)
 const source=readFileSync("lib/crew-queue.ts","utf8")
 assert.ok(source.indexOf("ensureOfflineUploadPath(userId,upload.id")<source.indexOf("const incident=await s.rpc"))
})
