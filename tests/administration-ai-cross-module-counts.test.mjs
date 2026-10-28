import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const route=readFileSync("app/api/administration/assistant/route.ts","utf8")
test("administration AI integrates bounded exact counts across financial, artist and inventory modules",()=>{
 for(const key of ["financialDocumentsPastDueDate","artistFollowUpsNextSevenDays","inventoryItemsWithDiscrepancies"])assert.ok(route.includes(key))
 assert.match(route,/const today=now\.toISOString\(\)\.slice\(0,10\)/)
 assert.match(route,/const nextWeek=new Date\(now\.getTime\(\)\+7\*86400000\)\.toISOString\(\)/)
 assert.match(route,/\.lt\("due_date",today\)/)
 assert.match(route,/\.gte\("follow_up_at",now\.toISOString\(\)\)\.lte\("follow_up_at",nextWeek\)/)
 assert.match(route,/\.or\("missing_quantity\.gt\.0,damaged_quantity\.gt\.0"\)/)
 assert.match(route,/count:"exact",head:true/)
})
test("due-date counts are not misrepresented as verified unpaid balances",()=>{
 assert.match(route,/Past-due documents are not necessarily unpaid/)
 assert.match(route,/Due date has passed; this is not proof that payment is outstanding/)
})
