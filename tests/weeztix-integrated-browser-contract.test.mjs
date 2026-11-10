import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const script=readFileSync('scripts/administration-completion-e2e.mjs','utf8')
const panel=readFileSync('components/crew/weeztix-scanner-panel.tsx','utf8')
const route=readFileSync('app/api/weeztix/scan/route.ts','utf8')

test('entrance E2E covers the current in-app scanner rather than obsolete vendor onboarding',()=>{
 assert.match(script,/heading',\{name:'Scan tickets',exact:true\}/)
 assert.match(script,/textbox',\{name:'Enter ticket barcode'\}/)
 assert.match(script,/pathname==='\/api\/weeztix\/scan'/)
 assert.match(script,/Unconfigured Weeztix scanning must not grant entrance/)
 assert.match(script,/Guestlist remains separate from the single entrance ticket scanner/)
 assert.doesNotMatch(script,/Scan tickets at the entrance|Prepare for entrance control|Scanner for iPhone/)
 assert.match(panel,/<section data-weeztix-scanner/)
 assert.match(panel,/fetch\("\/api\/weeztix\/scan"/)
})

test('scanner admission remains provider-authoritative and denies unconfigured events',()=>{
 assert.match(route,/if\(managed\.config\.WEEZTIX_SCANNING_ENABLED!=="true"/)
 assert.match(route,/return fail\("not_configured",503\)/)
 assert.match(route,/if\(response\.status===204\)return NextResponse\.json\(\{ok:true,code:"admitted"\}/)
 assert.match(script,/assert\.equal\(scanResult\.status\(\),503/)
 assert.match(script,/assert\.equal\(\(await scanResult\.json\(\)\)\.code,'not_configured'\)/)
})
