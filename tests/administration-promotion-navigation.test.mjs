import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
test("administration marketing promotion tasks stays inside administration",()=>{
 const marketing=readFileSync("app/(app)/portals/administration/modules/[slug]/page.tsx","utf8")
 const tasks=readFileSync("app/(app)/portals/administration/promotion-tasks/page.tsx","utf8")
 assert.match(marketing,/href="\/portals\/administration\/promotion-tasks"/)
 assert.doesNotMatch(marketing,/href="\/portals\/promotion\/tasks"/)
 assert.match(tasks,/getCurrentUser/)
 assert.match(tasks,/!actor.isAdmin&&!actor.isOwner/)
 assert.match(tasks,/href="\/portals\/administration\/promotion-discipline"/)
})
