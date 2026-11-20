import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {administrationNavigationGroups,administrationRoute,administrationCategoryForPath} from '../lib/administration/navigation.ts'
const source=readFileSync('components/administration/administration-navigation.tsx','utf8')
const expected=[['timesheets','planning'],['sales','finance'],['profile','management']]
for(const [slug,group] of expected){
 test(slug+' is reachable through the correct administration subtab',()=>{
  assert.ok(administrationNavigationGroups.find(g=>g.key===group)?.slugs.includes(slug))
  assert.equal(administrationRoute(slug),'/portals/administration/'+slug)
  assert.equal(administrationCategoryForPath(administrationRoute(slug)),group)
  assert.equal(administrationCategoryForPath(administrationRoute(slug)+'/details'),group)
  assert.match(source,new RegExp(slug+':'))
 })
}
