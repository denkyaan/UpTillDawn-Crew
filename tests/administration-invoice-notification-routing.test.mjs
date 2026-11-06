import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
test('legacy invoice notification links remain in the implemented invoice module',()=>{
 const source=readFileSync('lib/administration/navigation.ts','utf8')
 assert.match(source,/url\.pathname==="\/portals\/administration\/invoices"/)
 assert.match(source,/url\.pathname\.startsWith\("\/portals\/administration\/invoices\/"\)/)
 assert.match(source,/return administrationRoute\("invoices"\)\+url\.search\+url\.hash/)
 assert.doesNotMatch(source,/administrationRoute\("invoices"\)\+url\.pathname\.slice/)
})
