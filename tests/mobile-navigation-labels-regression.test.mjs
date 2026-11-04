import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync('components/layout/mobile-nav.tsx','utf8')
test('mobile navigation labels wrap instead of being truncated',()=>{
 assert.match(source,/whitespace-normal break-words text-center leading-tight/)
 assert.doesNotMatch(source,/className="block truncate">\{label\}/)
 assert.match(source,/data-layout-key=\{item\.key\}/)
})
test('removed tour no longer intercepts role navigation',()=>{
 assert.doesNotMatch(source,/tourPreview|trainingNavTarget|sandboxHelp|uptilldawn-training-workflow-v3|uptilldawn-tour-preview/)
 assert.match(source,/href=\{href\}/)
 assert.match(source,/setSelectedGroup\(\{key:"home",pathname\}\)/)
})
