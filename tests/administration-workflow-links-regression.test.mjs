import test from 'node:test'
import assert from 'node:assert/strict'
import {administrationWorkflowLinks,administrationWorkflowHref} from '../lib/administration/workflow-links.ts'
import {administrationNavigationGroups,administrationRoute} from '../lib/administration/navigation.ts'
const known=new Set(administrationNavigationGroups.flatMap(group=>group.slugs))
test('all workflow shortcuts stay inside administration and avoid self links',()=>{
 for(const [slug,href] of Object.entries(administrationWorkflowLinks)){
  assert.ok(known.has(slug),slug)
  assert.ok(href.startsWith('/portals/administration/')||href.startsWith('#'),slug)
  assert.notEqual(href,administrationRoute(slug),slug)
  assert.equal(administrationWorkflowHref(slug),href,slug)
 }
})
test('settings links to existing profile workflow',()=>{
 assert.equal(administrationWorkflowHref('settings'),'/portals/administration/profile')
})
test('unknown and self-referential workflows never produce a navigation target',()=>{
 assert.equal(administrationWorkflowHref('nonexistent'),null)
})
