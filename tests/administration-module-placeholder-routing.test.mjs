import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {administrationModules} from '../lib/administration/modules.ts'
import {administrationWorkspaceIntro} from '../lib/administration/workspace-copy.ts'
const source=readFileSync('app/(app)/portals/administration/modules/[slug]/page.tsx','utf8')
test('operational administration modules link to their workflow without misleading unavailable cards',()=>{
 assert.ok(!source.includes('{administrationWorkflowHref(slug)&&<div'))
 assert.ok(source.includes('<OperationalWorkQueue'))
 assert.ok(!source.includes('sections.map('))
 assert.ok(!source.includes('{u.pending}'))
 assert.ok(!source.includes('{t.phase}'))
 assert.ok(source.includes('{intro[locale]}'))
 for(const entry of administrationModules.filter(item=>!['dashboard','finance'].includes(item.slug))){
  for(const locale of ['nl','fr','en','de'])assert.ok(administrationWorkspaceIntro[entry.slug]?.[locale]?.length,entry.slug+' '+locale)
 }
})
