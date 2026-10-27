import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const page=readFileSync('app/(app)/portals/[portal]/page.tsx','utf8')
test('administration overview shows a direct AI assistant entry in all four languages',()=>{
 const section=page.slice(page.indexOf('{!promotion && <section className="space-y-4"'),page.indexOf('{!promotion && <nav'))
 assert.match(section,/href="\/portals\/administration\/modules\/ai"/)
 for(const label of ['AI-assistent','Assistant IA','AI assistant','KI-Assistent'])assert.ok(section.includes(label),label)
 assert.match(section,/focus-visible:outline/)
})
