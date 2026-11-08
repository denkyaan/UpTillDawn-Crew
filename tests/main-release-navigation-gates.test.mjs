import test from 'node:test'
import assert from 'node:assert/strict'
import {administrationNavigationGroups,administrationRoute,administrationCategoryForPath,administrationNotificationHref} from '../lib/administration/navigation.ts'
import {PORTALS,accessiblePortals,canOpenPortal,safeNotificationPath} from '../lib/portal-access.ts'

const account={approved:true,blocked:false}
const grant=(portal,role)=>({portal,role,approved:true,revoked_at:null})

test('release: all administration subtabs preserve their own portal and category',()=>{
 const seen=new Set()
 for(const group of administrationNavigationGroups){
  for(const slug of group.slugs){
   const url=administrationRoute(slug)
   assert.ok(url.startsWith('/portals/administration'),slug)
   assert.equal(administrationCategoryForPath(url),group.key,slug)
   assert.ok(!seen.has(url),'duplicate route '+url)
   seen.add(url)
   assert.equal(administrationNotificationHref(url+'?from=release'),url+'?from=release')
  }
 }
})

test('release: notifications preserve safe navigation and block cross-portal destinations',()=>{
 assert.equal(administrationNotificationHref('/tasks?view=mine'),administrationRoute('tasks')+'?view=mine')
 assert.equal(administrationNotificationHref('/portals/administration/invoices/42'),administrationRoute('invoices'))
 for(const path of ['/portals/promotion','/portals/admin','/portals/administration/unknown','/portals/administration/../promotion','/portals/administration/finance/%252fadmin']){
  assert.equal(administrationNotificationHref(path),null,path)
 }
 for(const path of ['//evil.test','/notifications/../admin','/notifications/%252fadmin','/notifications/%250a']){
  assert.equal(safeNotificationPath(path),'/notifications',path)
 }
 assert.equal(safeNotificationPath('/notifications?tab=unread'),'/notifications?tab=unread')
})

test('release: every portal requires a matching approved active assignment',()=>{
 for(const portal of PORTALS){
  const role={events:'event_staff',promotion:'promoter',administration:'administrative_staff'}[portal]
  const grants=[grant(portal,role)]
  assert.equal(canOpenPortal(portal,grants,account),true)
  assert.deepEqual(accessiblePortals(grants,{approved:false,blocked:false}),[])
  assert.deepEqual(accessiblePortals(grants,{approved:true,blocked:true}),[])
  assert.deepEqual(accessiblePortals(grants.map(x=>({...x,approved:false})),account),[])
  assert.deepEqual(accessiblePortals(grants.map(x=>({...x,revoked_at:'2026-11-08T00:00:00Z'})),account),[])
  for(const other of PORTALS.filter(x=>x!==portal))assert.equal(canOpenPortal(other,grants,account),false)
 }
})
