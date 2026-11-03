import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync('components/layout/mobile-nav.tsx','utf8')
test('expanded navigation labels wrap instead of being truncated',()=>{
 assert.match(source,/block whitespace-normal break-words leading-snug/)
 assert.doesNotMatch(source,/className="block truncate">\{label\}/)
 assert.match(source,/data-layout-key=\{item\.key\}/)
})
