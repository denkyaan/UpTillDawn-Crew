import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const ui=readFileSync(new URL('../components/crew/timesheet-controls.tsx',import.meta.url),'utf8')
test('timesheet mutations refresh route data without resetting the entire portal',()=>{
 assert.match(ui,/useRouter/)
 assert.match(ui,/router\.refresh\(\)/)
 assert.doesNotMatch(ui,/location\.reload\(/)
})
test('timesheet mutations release busy state on success and error',()=>{
 assert.match(ui,/if\(busy\)return/)
 assert.match(ui,/finally\s*\{setBusy\(false\)\}/)
 assert.match(ui,/role="status" aria-live="polite"/)
 assert.match(ui,/role="alert"/)
})
