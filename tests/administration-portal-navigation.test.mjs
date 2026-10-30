import test from 'node:test'
import assert from 'node:assert/strict'
import {readdirSync} from 'node:fs'
import {join} from 'node:path'
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
 for(const [slug,category] of [['timesheets','planning'],['profile','management'],['sales','finance'],['counterparties','relations'],['contacts','relations']]){
  assert.equal(administrationCategoryForPath('/portals/administration/'+slug),category)
 }
})

test('every concrete administration page retains a category, including existing module aliases',()=>{
 const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(join(dir,entry.name)):[join(dir,entry.name)])
 for(const file of walk('app/(app)/portals/administration').filter(file=>file.endsWith('/page.tsx')&&!file.includes('['))){
  const path=file.replace('app/(app)','').replace('/page.tsx','')
  if(path==='/portals/administration'||path==='/portals/administration/overview')continue
  assert.notEqual(administrationCategoryForPath(path),'overview',path+' lost its module category')
 }
})

test('notification destinations preserve event and chat context within administration',()=>{
 assert.equal(administrationNotificationHref('/timesheets?event=123'),'/portals/administration/timesheets?event=123')
 assert.equal(administrationNotificationHref('/chat?channel=abc'),null)
 assert.equal(administrationNotificationHref('/inventory?event=123#stock'),'/portals/administration/modules/inventory?event=123#stock')
 assert.equal(administrationNotificationHref('/portals/administration/finance?document=abc'),'/portals/administration/finance?document=abc')
})

test('unsafe and unsupported notification targets cannot open the personnel portal',()=>{
 for(const value of [null,'https://example.com','//example.com','/\\example.com','/\n/example.com/portals/administration/finance','/\t/example.com/portals/administration/finance','/operations','/events/123/command','/portals/promotion']){
  assert.equal(administrationNotificationHref(value),null,value)
 }
})
