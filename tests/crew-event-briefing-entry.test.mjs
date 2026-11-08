import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync(new URL('../app/(app)/events/page.tsx',import.meta.url),'utf8')
test('assigned crew enters selected event briefing without obsolete onboarding tour',()=>{
 assert.match(source,/!user\.isAdmin&&assigned&&<Link href=\{'\/briefings\?event='\+encodeURIComponent\(event\.id\)\}/)
 assert.doesNotMatch(source,/href=\{'\/onboarding\?event='/)
})
