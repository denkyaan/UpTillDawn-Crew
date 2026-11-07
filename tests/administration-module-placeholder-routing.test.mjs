import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync('app/(app)/portals/administration/modules/[slug]/page.tsx','utf8')
test('operational administration modules link to their workflow without misleading unavailable cards',()=>{
 assert.ok(source.includes('{administrationWorkflowHref(slug)&&<div'))
 assert.ok(source.includes('{!administrationWorkflowHref(slug)&&<section className="grid gap-4 md:grid-cols-3"'))
 assert.ok(source.includes('{u.notAvailable}'))
 assert.ok(source.includes('{u.pending}'))
})
