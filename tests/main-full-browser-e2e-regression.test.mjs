import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const browser=readFileSync('scripts/administration-full-browser-e2e.mjs','utf8')
const peppol=readFileSync('scripts/administration-peppol-e2e.mjs','utf8')

test('admin full-browser click verification starts from the settled canonical route',()=>{
 assert.match(browser,/expectedPath=route==='\/portals\/administration\/overview'\?'\/portals\/administration'/)
 assert.match(browser,/await tab\.goto\(base\+path,\{waitUntil:'domcontentloaded',timeout:30000\}\)/)
 assert.match(browser,/await tab\.waitForURL\(u=>u\.pathname\+u\.search===path/)
 assert.doesNotMatch(browser,/await tab\.goto\(base\+route/)
 // Still require real link clicks, final URL checks and diagnostic screenshots.
 assert.match(browser,/href\.click\(\{timeout:15000\}\)/)
 assert.match(browser,/finalPath!==expectedClickedPath/)
 assert.match(browser,/tab\.screenshot/)
})

test('Peppol E2E targets only one currently visible invoice reference panel',()=>{
 assert.match(peppol,/locator\('#app-scroll details:visible'\)/)
 assert.match(peppol,/Exactly one visible Peppol reference panel must be active/)
 assert.match(peppol,/locator\('summary:visible'\)\.click\(\)/)
 assert.match(peppol,/locator\('form:visible'\)/)
 assert.match(peppol,/form:visible:has\(input\[name="line_id"\]/)
 // Keep actual Server Action, database persistence and XML correctness assertions.
 assert.match(peppol,/await submit\(office\.page,referenceForm\.getByRole\('button'\)\)/)
 assert.match(peppol,/\.buyer_reference,'TEST-PO-UI'/)
 assert.match(peppol,/\.unit_code,'DAY'/)
 assert.match(peppol,/paidXml\.includes/)
})
