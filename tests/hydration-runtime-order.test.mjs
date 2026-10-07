import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

test('runtime translation waits until after app children hydration',async()=>{
 const [layout,sync]=await Promise.all([
  readFile(new URL('../app/layout.tsx',import.meta.url),'utf8'),
  readFile(new URL('../components/locale-sync.tsx',import.meta.url),'utf8'),
 ])
 assert.ok(layout.indexOf('{children}')<layout.indexOf('<LocaleSync />'),'LocaleSync must mount after app children')
 assert.match(sync,/setTimeout\(\(\)=>\s*\{[\s\S]*requestAnimationFrame\(\(\)=>\s*\{[\s\S]*requestAnimationFrame\([\s\S]*\},1200\)/)
})

test('event tour follows the current interactive action',async()=>{
 const source=await readFile(new URL('../components/training/sandbox-events.tsx',import.meta.url),'utf8')
 assert.match(source,/data-tour-demo=\{!open\?"primary-action":undefined\}/)
 assert.match(source,/data-tour-demo=\{open&&!saved\?"primary-action":undefined\}/)
 const tour=await readFile(new URL('../components/training/tour-control-center.tsx',import.meta.url),'utf8')
 assert.match(tour,/nestedPrimary=container\?\.querySelector\('\[data-tour-demo="primary-action"\]:not\(:disabled\)'\)/)
 assert.match(tour,/fallbackAction=container\?\.querySelector\('button:not\(:disabled\), summary, input:not\(:disabled\)'\)/)
 assert.match(tour,/const found=exactPrimary\|\|nestedPrimary\|\|fallbackAction\|\|container/)
})


test('tour panel text never blocks the highlighted page action',async()=>{
 const source=await readFile(new URL('../components/training/tour-control-center.tsx',import.meta.url),'utf8')
 assert.match(source,/data-tour-panel[\s\S]*pointer-events-none/)
 assert.match(source,/pointer-events-auto[\s\S]*PAUZEER/)
})
