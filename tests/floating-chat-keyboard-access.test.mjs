import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const source=readFileSync(new URL('../components/layout/floating-chat-button.tsx',import.meta.url),'utf8')

test('draggable chat button remains operable by keyboard',()=>{
 assert.match(source,/onKeyDown=\{\(event\) => \{/)
 assert.match(source,/event\.key === "Enter" \|\| event\.key === " "/)
 assert.match(source,/event\.preventDefault\(\)/)
 assert.match(source,/!event\.repeat\) router\.push\(href\)/)
 assert.match(source,/onPointerUp=\{finish\}/)
})
