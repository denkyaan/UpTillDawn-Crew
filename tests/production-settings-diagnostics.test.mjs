import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const settings=readFileSync('app/(app)/portals/administration/modules/settings/page.tsx','utf8')
const navigation=readFileSync('scripts/administration-navigation-e2e.mjs','utf8')
const peppol=readFileSync('scripts/administration-peppol-e2e.mjs','utf8')
const workflow=readFileSync('.github/workflows/ci.yml','utf8')
test('settings server errors remain fail-closed and diagnostics are isolated to the local QA bridge',()=>{
 assert.match(settings,/process\.env\.UPT_E2E_SESSION_BRIDGE==="1"/)
 assert.match(settings,/throw error/)
 assert.match(settings,/UPT_SETTINGS_RENDER_FAILURE/)
 assert.match(settings,/stage="billing"/)
})
test('browser failures report route, body, status and uncaught exceptions without credentials',()=>{
 assert.match(navigation,/pageText/)
 assert.match(navigation,/uncaught:errors/)
 assert.match(peppol,/PEPPOL_PAGE_DIAGNOSTIC/)
 assert.match(workflow,/grep -F -A 7 'UPT_SETTINGS_RENDER_FAILURE'/)
 assert.doesNotMatch(navigation,/console\.log\(.*password|console\.log\(.*access_token/)
})