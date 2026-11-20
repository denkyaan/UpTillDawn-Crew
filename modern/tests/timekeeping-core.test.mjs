import test from "node:test"
import assert from "node:assert/strict"
import {breakAlert,formatWorkDuration} from "../src/shared/break-clock.ts"
import {timekeepingCopy} from "../src/shared/timekeeping-copy.ts"
import {languages} from "../src/shared/i18n.ts"
import {readFileSync} from "node:fs"
const read=x=>readFileSync(new URL("../src/"+x,import.meta.url),"utf8")
test("five-minute on-device break alert and after-70-minute warning have exact boundaries",()=>{
 const started="2026-11-19T10:00:00.000Z",at=Date.parse(started)
 assert.equal(breakAlert(started,at-1),"none")
 assert.equal(breakAlert(started,at+54*60000+59999),"none")
 assert.equal(breakAlert(started,at+55*60000),"five_minutes")
 assert.equal(breakAlert(started,at+69*60000+59999),"five_minutes")
 assert.equal(breakAlert(started,at+70*60000),"overdue")
 assert.equal(breakAlert("wrong",at),"none")
 assert.equal(breakAlert(null,at),"none")
 assert.equal(formatWorkDuration(3660),"1u 01m")
 assert.equal(formatWorkDuration(-3),"—")
})
test("break operations use audited server RPC and never direct client writes",()=>{
 const src=read("lib/break-operations.ts")
 for(const rpc of ["upt_start_break","upt_stop_break","upt_work_session_time_summary"])
  assert.ok(src.includes('.rpc("'+rpc+'"'),rpc)
 for(const name of ['.from("break_sessions")','.eq("user_id",uid)','.eq("work_session_id",sessionId)',
   '.limit(30).abortSignal(signal)','await verifyOwnSession()'])
  assert.ok(src.includes(name),name)
 for(const forbidden of [".insert(",".update(",".delete(",".upsert("])assert.ok(!src.includes(forbidden))
})
test("timekeeping wording is complete across NL FR EN DE",()=>{
 for(const locale of languages)for(const key of ["breakStart","breakStop","breakReminder","breakOver","gross","excess","net","pendingOut","notStopped"])
  assert.ok(timekeepingCopy(locale)[key].length>=3,locale+":"+key)
})
