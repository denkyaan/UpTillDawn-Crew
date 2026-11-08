import test from 'node:test'
import assert from 'node:assert/strict'
import {administrationNavigationGroups,administrationRoute,administrationCategoryForPath,administrationNotificationHref} from '../lib/administration/navigation.ts'

test('every administration subtab resolves inside its portal and has a consistent active category',()=>{
 const routes=new Set()
 for(const group of administrationNavigationGroups){
  for(const slug of group.slugs){
   const path=administrationRoute(slug)
   assert.ok(path.startsWith('/portals/administration'),slug)
   assert.equal(administrationCategoryForPath(path),group.key,slug)
   assert.ok(!routes.has(path),'duplicate subtab destination: '+path)
   routes.add(path)
   if(slug!=='dashboard')assert.equal(administrationCategoryForPath(path+'/detail'),group.key,slug)
  }
 }
})

test('administration notifications never navigate into another role portal',()=>{
 for(const url of ['/portals/admin','/portals/personnel','/portals/promotion','//evil.example/path','/portals/administration/%2e%2e/admin']){
  assert.equal(administrationNotificationHref(url),null,url)
 }
})

test('legacy invoice detail notifications resolve to an existing administration overview',()=>{
 const expected=administrationRoute('invoices')+'?from=notification'
 for(const url of ['/portals/administration/invoices/123?from=notification','/portals/administration/modules/invoices/123?from=notification']){
  assert.equal(administrationNotificationHref(url),expected,url)
 }
})
