import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {administrationNavigationGroups,administrationRoute,administrationCategoryForPath} from '../lib/administration/navigation.ts'
const source=readFileSync(new URL('../components/administration/administration-navigation.tsx',import.meta.url),'utf8')
test('all administration category subtabs resolve inside the administration portal',()=>{
 for(const group of administrationNavigationGroups){
  for(const slug of group.slugs){
   const href=administrationRoute(slug)
   assert.ok(href.startsWith('/portals/administration'),slug)
   assert.equal(administrationCategoryForPath(href),group.key,slug)
  }
 }
})
test('subtabs remain accessible but start collapsed on module routes after navigation',()=>{
 assert.match(source,/const visible=selected\.key!=="overview"/)
 assert.match(source,/selectedCategory\?\.pathname===pathname\?selectedCategory\.key:"overview"/)
 assert.ok(!source.includes('const visible=selected.key!=="overview"&&selectedCategory?.pathname===pathname'))
 assert.match(source,/data-administration-subtab=\{slug\}/)
})
test('finance and planning nested routes retain their correct category',()=>{
 assert.equal(administrationCategoryForPath('/portals/administration/modules/invoices/123/peppol'),'finance')
 assert.equal(administrationCategoryForPath('/portals/administration/modules/artists/123/agreement'),'planning')
})
