import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {administrationNavigationGroups,administrationRoute,administrationCategoryForPath,administrationNotificationHref} from '../lib/administration/navigation.ts'
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

test('administration subtabs use client navigation without reloading the portal shell',()=>{
 assert.match(source,/import Link from "next\/link"/)
 assert.match(source,/return <Link key=\{slug\} data-administration-subtab=\{slug\} href=\{route\(slug\)\}/)
 assert.doesNotMatch(source,/return <a key=\{slug\} data-administration-subtab/)
})

test('administration notification links reject external, encoded and cross-portal destinations',()=>{
 for(const value of ['//example.com','/portals/promotion','/portals/staff','/portals/administration/%2e%2e/promotion','/portals/administration/%2f%2fevil','/portals/administration/%5cother','/portals/administration/\\\\other','/%00bad']){
  assert.equal(administrationNotificationHref(value),null,value)
 }
 assert.equal(administrationNotificationHref('/tasks?event=123'),'/portals/administration/modules/tasks?event=123')
 assert.equal(administrationNotificationHref('/portals/administration/invoices'),'/portals/administration/modules/invoices')
 assert.equal(administrationNotificationHref('/portals/administration/invoices/123?tab=payments'),'/portals/administration/modules/invoices/123?tab=payments')
})

test('counterparty records stay in relations when navigating to details',()=>{
 assert.equal(administrationCategoryForPath('/portals/administration/counterparties'),'relations')
 assert.equal(administrationCategoryForPath('/portals/administration/counterparties/123'),'relations')
})

test('legacy administration module notifications stay inside the administration portal',()=>{
 for(const slug of ['invoices','banking','ticketing','inventory','reports','documents','artists','contracts']){
  assert.equal(administrationNotificationHref('/portals/administration/'+slug),administrationRoute(slug),slug)
  assert.equal(administrationNotificationHref('/portals/administration/'+slug+'/record?filter=open#details'),administrationRoute(slug)+'/record?filter=open#details',slug)
 }
 assert.equal(administrationNotificationHref('/portals/administration/invoices-other'),'/portals/administration/invoices-other')
 assert.equal(administrationNotificationHref('/portals/promotion/tasks'),null)
})
