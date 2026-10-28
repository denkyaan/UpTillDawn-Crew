import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const home=readFileSync('app/(app)/portals/promotion/page.tsx','utf8')
const tasks=readFileSync('app/(app)/portals/promotion/tasks/page.tsx','utf8')
const discipline=readFileSync('app/(app)/portals/administration/promotion-discipline/page.tsx','utf8')
test('promotion overview exposes chat and tasks in four languages',()=>{
 for(const locale of ['nl','fr','en','de'])assert.match(home,new RegExp('\\b'+locale+':\\{'))
 assert.match(home,/href="\/portals\/promotion\/chats"/)
 assert.match(home,/href="\/portals\/promotion\/tasks"/)
 assert.match(home,/upt_promotion_is_blocked/)
 assert.match(home,/task_assignments/)
})
test('promotion evidence status uses localized labels',()=>{
 assert.match(tasks,/status in evidenceStatusLabels\[locale\]/)
 assert.match(tasks,/File matches reference; publication not verified/)
})
test('promotion discipline honors permanent admin role',()=>{
 assert.match(discipline,/actor\?\.realIsAdmin/)
 assert.doesNotMatch(discipline,/!actor\?\.isAdmin&&!actor\?\.isOwner/)
})
