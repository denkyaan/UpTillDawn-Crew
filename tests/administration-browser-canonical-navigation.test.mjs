import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {administrationNavigationGroups,administrationRoute} from '../lib/administration/navigation.ts'

const source=readFileSync(new URL('../scripts/administration-navigation-e2e.mjs',import.meta.url),'utf8')

test('Administration browser E2E uses canonical source-of-truth groups rather than obsolete duplicated shortcuts',()=>{
 assert.match(source,/import \{administrationNavigationGroups\} from '\.\.\/lib\/administration\/navigation\.ts'/)
 assert.match(source,/const groups=Object\.fromEntries\(/)
 assert.match(source,/new Set\(canonicalSlugs\)\.size/)
 assert.doesNotMatch(source,/const groups=\{planning:/)
 const groups=administrationNavigationGroups.filter(g=>g.key!=='overview')
 const all=groups.flatMap(group=>group.slugs)
 assert.equal(all.length,new Set(all).size)
 assert.ok(all.includes('counterparties'))
 assert.ok(!all.includes('contacts'))
 assert.ok(all.includes('promotion-tasks'))
 assert.ok(all.includes('timesheets'))
 assert.ok(all.includes('sales'))
 assert.ok(all.includes('profile'))
 assert.equal(administrationRoute('counterparties'),'/portals/administration/counterparties')
})
