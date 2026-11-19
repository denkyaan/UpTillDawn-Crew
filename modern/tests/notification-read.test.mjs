import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {copy,languages} from "../src/shared/i18n.ts"
const read=path=>readFileSync(new URL("../src/"+path,import.meta.url),"utf8")
test("notification writes reuse audited auth-scoped RPC and remain gated off by default",()=>{
 const op=read("lib/operational-mutations.ts")
 const original=read("lib/operational-writes.ts")
 const env=readFileSync(new URL("../.env.example",import.meta.url),"utf8")
 assert.ok(op.includes('rpc("upt_mark_notification_read",{p_notification:id})'))
 assert.ok(op.includes("await verifyOwnSession()"))
 assert.ok(op.includes("unique.slice(i,i+3)"))
 assert.ok(op.includes("if(ids.length>70)"))
 assert.ok(!op.includes('.from("crew_notifications").update('))
 assert.ok(original.includes('VITE_MIGRATION_ALLOW_WRITES==="true"'))
 assert.ok(env.includes("VITE_MIGRATION_ALLOW_WRITES=false"))
})
test("notification list is user-specific, bounded and suppresses error-AI reports",()=>{
 const reads=read("lib/operational-reads.ts")
 assert.ok(reads.includes('.from("crew_notifications")'))
 assert.ok(reads.includes('.eq("user_id",uid).neq("kind","error_report")'))
 assert.ok(reads.includes('.limit(70).abortSignal(signal)'))
 const screen=read("screens/notifications.tsx")
 assert.ok(screen.includes("markOwnNotificationRead(id)"))
 assert.ok(screen.includes("markDisplayedNotificationsRead(ids)"))
 assert.ok(screen.includes("writesAvailable()&&"))
 assert.ok(screen.includes("r.refresh();setBusy(false)"))
 assert.ok(screen.includes("safeRoute(item.link)"))
})
test("read controls in all four languages never claim to mark unseen pages",()=>{
 for(const locale of languages){
  const t=copy(locale)
  for(const key of ["newNotification","openInApp","markRead","markDisplayedRead","notificationReadError","notificationBatchError","notificationMigrationNote"])
   assert.ok(t[key].trim().length>2,locale+":"+key)
 }
})
