import test from 'node:test'
import assert from 'node:assert/strict'
import {administrationNavigationGroups,administrationRoute,administrationCategoryForPath,administrationNotificationHref} from '../lib/administration/navigation.ts'

test('every administration subtab retains its category after navigation',()=>{
 for(const group of administrationNavigationGroups){
  for(const slug of group.slugs){
   const route=administrationRoute(slug)
   assert.ok(route==='/portals/administration'||route.startsWith('/portals/administration/'))
   assert.equal(administrationCategoryForPath(route),group.key,slug)
   if(slug!=='dashboard')assert.equal(administrationCategoryForPath(route+'/detail'),group.key,slug+' detail')
  }
 }
})

test('dashboard prefix does not swallow invoice and artist detail routes',()=>{
 assert.equal(administrationCategoryForPath('/portals/administration/modules/invoices/123'),'finance')
 assert.equal(administrationCategoryForPath('/portals/administration/modules/artists/123/agreement'),'planning')
 assert.equal(administrationCategoryForPath('/portals/administration/modules/permits'),'operations')
})

test('shared administration pages retain their navigation category',()=>{
 for(const [slug,category] of [['timesheets','planning'],['profile','management'],['sales','finance'],['counterparties','relations']]){
  assert.equal(administrationCategoryForPath('/portals/administration/'+slug),category)
 }
})

test('notification destinations preserve event and chat context within administration',()=>{
 assert.equal(administrationNotificationHref('/timesheets?event=123'),'/portals/administration/timesheets?event=123')
 assert.equal(administrationNotificationHref('/chat?channel=abc'),'/portals/administration/chat?channel=abc')
 assert.equal(administrationNotificationHref('/inventory?event=123#stock'),'/portals/administration/modules/inventory?event=123#stock')
 assert.equal(administrationNotificationHref('/portals/administration/finance?document=abc'),'/portals/administration/finance?document=abc')
})

test('unsafe and unsupported notification targets cannot open the personnel portal',()=>{
 for(const value of [null,'https://example.com','//example.com','/\\example.com','/operations','/events/123/command','/portals/promotion']){
  assert.equal(administrationNotificationHref(value),null,value)
 }
})
