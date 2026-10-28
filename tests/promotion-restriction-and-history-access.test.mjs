import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const layout=readFileSync("app/(app)/portals/promotion/layout.tsx","utf8")
const tasks=readFileSync("app/(app)/portals/promotion/tasks/page.tsx","utf8")
const home=readFileSync("app/(app)/portals/promotion/page.tsx","utf8")
test("suspended promotion members can read their suspension notice without bypassing access checks",()=>{
 assert.match(layout,/canOpenPortal\("promotion"/)
 assert.doesNotMatch(layout,/if\(!current\.isOwner&&!current\.realIsAdmin&&\(blockError\|\|blocked\)\)redirect/)
 assert.match(home,/isBlocked&&<p role="alert"/)
 assert.match(tasks,/isPromotionBlocked&&<p role="alert"/)
 assert.match(tasks,/if\(blockError\|\|blocked\)throw new Error\("Promotion access blocked"\)/)
 assert.match(tasks,/!isPromotionBlocked&&item\.status==="NOT STARTED"/)
 assert.match(tasks,/!isPromotionBlocked&&item\.status==="IN PROGRESS"/)
})
test("promotion task history clearly discloses bounded evidence listing",()=>{
 assert.match(tasks,/evidenceRows\.length===100/)
 for(const phrase of ["100 recentste bewijsindieningen","100 derniers dépôts","100 most recent evidence","100 neuesten Nachweise"])assert.ok(tasks.includes(phrase))
})
