import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=path=>readFileSync(path,'utf8')
test('local browser compares exact legacy redirect destinations and explicit role-hidden states',()=>{
 const qa=read('modern/tests/qa-local-release-browser.mjs')
 const router=read('modern/src/screens/original-application.tsx')
 assert.match(read('app/(app)/admin/management/page.tsx'),/redirect\('\/admin'\)/)
 assert.match(read('app/(app)/admin/health/page.tsx'),/redirect\('\/admin'\)/)
 assert.match(read('app/(app)/portals/administration/overview/page.tsx'),/redirect\("\/portals\/administration"\)/)
 assert.ok(router.includes("if(auth.user&&(location.pathname==='/admin/management'||location.pathname==='/admin/health'))"))
 assert.ok(router.includes("if(auth.user&&location.pathname==='/portals/administration/overview')"))
 assert.match(qa,/finalPath!==exactAliases\[path\]/)
 assert.match(qa,/expectedHidden\[meta.role\]\?\.includes\(path\)/)
 assert.match(qa,/expected\.featureHidden\.length!==1/)
 assert.match(read('components/layout/app-layout.tsx'),/data-feature-hidden="true"/)
})
test('actual browser login proves navigation and verified signed cookies without racing the consumed response body',()=>{
 const qa=read('modern/tests/qa-local-release-browser.mjs')
 const login=qa.slice(qa.indexOf('async function browserLogin'),qa.indexOf('async function signedState'))
 assert.doesNotMatch(login,/login\.json\(\)/)
 assert.match(login,/redirect-or-error/)
 assert.match(login,/verifyCookieIdentity\(context,role\)/)
 assert.match(login,/ready\(page,'nl'\)/)
 assert.match(login,/destination\.pathname!==expectedLanding/)
})
test('local read adapter executes existing guarded handlers instead of synthetic responses',()=>{
 const qa=read('modern/tests/qa-local-release-browser.mjs')
 for(const handler of ['administrationReportResponse','nativeBankStatementRegister','nativeProviderSettlementRegister','nativePontoGet','nativeAdministrationPermission'])assert.ok(qa.includes(handler+'(db'))
 assert.match(qa,/blockedRoutes\.size\|\|readRouteFailures\.size/)
 assert.match(qa,/nativePontoGet\(db,\{\}\)/)
 assert.match(qa,/if\(permitted!==200\)/)
})
