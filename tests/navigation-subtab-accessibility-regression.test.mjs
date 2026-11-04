import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

test('administration subtabs expose a labelled region and preserve navigation behavior',()=>{
 const source=readFileSync('components/administration/administration-navigation.tsx','utf8')
 assert.ok(source.includes('id="administration-subtabs" role="region" aria-label={selected.title[locale]}'))
 assert.ok(source.includes('aria-controls={group.key==="overview"'))
 assert.ok(source.includes('onClick={()=>setSelectedCategory({key:"overview",pathname})}'))
})
test('role subtabs expose a translated region and retain close-on-navigation behavior',()=>{
 const source=readFileSync('components/layout/mobile-nav.tsx','utf8')
 assert.ok(source.includes('id="role-navigation-subtabs" role="region"'))
 for(const locale of ['nl:','fr:','en:','de:'])assert.ok(source.includes(locale))
 assert.ok(source.includes('setSelectedGroup({key:"home",pathname})'))
 assert.ok(source.includes('aria-controls={group.key==="home"'))
})
