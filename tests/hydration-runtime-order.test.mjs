import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

test('runtime translation waits until after app children hydration',async()=>{
 const [layout,sync]=await Promise.all([
  readFile(new URL('../app/layout.tsx',import.meta.url),'utf8'),
  readFile(new URL('../components/locale-sync.tsx',import.meta.url),'utf8'),
 ])
 assert.ok(layout.indexOf('{children}')<layout.indexOf('<LazyLocaleSync />'),'Local translation must mount after app children')
 const bootstrap=await readFile(new URL('../components/lazy-client-bootstraps.tsx',import.meta.url),'utf8')
 assert.match(bootstrap,/import\("@\/components\/locale-sync"\)/)
 assert.match(bootstrap,/ssr:false/)
 assert.match(sync,/setTimeout\(\(\)=>\s*\{[\s\S]*requestAnimationFrame\(\(\)=>\s*\{[\s\S]*requestAnimationFrame\([\s\S]*\},1200\)/)
})

test('operational hydration is independent of retired tour overlays',async()=>{
 const layout=await readFile(new URL('../components/layout/app-layout.tsx',import.meta.url),'utf8')
 assert.doesNotMatch(layout,/RoleAppTour|TourControlCenter|SandboxRoleModule/)
})
