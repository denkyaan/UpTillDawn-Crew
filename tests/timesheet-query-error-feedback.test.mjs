import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync(new URL('../app/(app)/timesheets/page.tsx',import.meta.url),'utf8')
test('timesheets show localized errors rather than falsely claiming no data',()=>{
 for(const locale of ['nl','fr','en','de'])assert.match(source,new RegExp('\\b'+locale+':\\{[^\\n]*loadError:'))
 assert.match(source,/if\(eventLoadError\)return <main/)
 assert.match(source,/if\(error\)return <main[^\n]*copy\.loadError/)
 assert.match(source,/role="alert"/)
})
test('event discovery errors are checked for admin and crew queries',()=>{
 assert.match(source,/if\(isAdmin\)\{[\s\S]*?if\(error\)eventLoadError=true/)
 assert.match(source,/\}else\{[\s\S]*?if\(error\)eventLoadError=true/)
})
