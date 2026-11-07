import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync('app/(app)/portals/administration/modules/[slug]/page.tsx','utf8')
test('unfinished administration sections do not repeat the same unrelated workflow action',()=>{
 assert.match(source,/administrationWorkflowHref\(slug\)&&<div/)
 assert.doesNotMatch(source,/\{administrationWorkflowHref\(slug\)\?<Link/)
 assert.doesNotMatch(source,/\{u\.pending\}/)
 assert.match(source,/administrationWorkspaceIntro\[slug\]/)
})
test('marketing instructions keep users in administration',()=>{
 assert.match(source,/Beheer promotietaken binnen Administratie/)
 assert.doesNotMatch(source,/Beheer promotietaken via het promotieportaal/)
})
