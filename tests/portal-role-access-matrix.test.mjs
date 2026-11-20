import test from 'node:test'
import assert from 'node:assert/strict'
import {PORTALS,accessiblePortals,canOpenPortal,safeNotificationPath} from '../lib/portal-access.ts'

const active={approved:true,blocked:false}
const assignment=(portal,role,extra={})=>({portal,role,approved:true,revoked_at:null,...extra})

test('portal access requires an active account and an explicitly approved non-revoked assignment',()=>{
 const roles=[assignment('events','event_staff'),assignment('promotion','promoter'),assignment('administration','administrative_staff')]
 assert.deepEqual(accessiblePortals(roles,active),[...PORTALS])
 assert.deepEqual(accessiblePortals(roles,{approved:false,blocked:false}),[])
 assert.deepEqual(accessiblePortals(roles,{approved:true,blocked:true}),[])
 assert.deepEqual(accessiblePortals(roles.map(x=>({...x,approved:false})),active),[])
 assert.deepEqual(accessiblePortals(roles.map(x=>({...x,revoked_at:'2026-11-08T00:00:00Z'})),active),[])
})

test('multiple roles grant only their own portal permissions, never cross-portal escalation',()=>{
 const roles=[assignment('events','event_staff'),assignment('promotion','promoter')]
 assert.deepEqual(accessiblePortals(roles,active),['events','promotion'])
 assert.equal(canOpenPortal('administration',roles,active),false)
 assert.equal(canOpenPortal('promotion',roles,active),true)
 assert.equal(canOpenPortal('admin',roles,active),false)
 assert.deepEqual(accessiblePortals([assignment('administration','promoter')],active),[])
 assert.deepEqual(accessiblePortals([assignment('events','administrative_staff')],active),[])
 assert.deepEqual(accessiblePortals([assignment('promotion','event_responsible')],active),[])
})

test('admin assignments are scoped to the assigned portal, not automatically global',()=>{
 assert.deepEqual(accessiblePortals([assignment('events','admin')],active),['events'])
 assert.deepEqual(accessiblePortals([assignment('administration','admin')],active),['administration'])
 assert.deepEqual(accessiblePortals([assignment('promotion','admin')],active),['promotion'])
})

test('notification paths reject external, encoded traversal and control-character destinations',()=>{
 for(const input of [null,undefined,12,'https://example.com','//example.com','/\\example','/%2e%2e/admin','/%2fadmin','/%5cadmin','/a\nb']){
  assert.equal(safeNotificationPath(input),'/notifications',String(input))
 }
 assert.equal(safeNotificationPath('/notifications?tab=unread'),'/notifications?tab=unread')
})

test('shared notification targets reject parent traversal and double-encoded path controls',()=>{
 for(const input of [
  '/../admin','/notifications/../admin','/notifications/%252e%252e/admin',
  '/notifications/%252fadmin','/notifications/%250a','/notifications/%0a',
  '/notifications/%7f','/notifications/%5cadmin',
 ]){
  assert.equal(safeNotificationPath(input),'/notifications',input)
 }
 assert.equal(safeNotificationPath('/notifications/./detail?search=%252e%252e#recent'),'/notifications/detail?search=%252e%252e#recent')
 assert.equal(safeNotificationPath('/notifications?tab=unread#today'),'/notifications?tab=unread#today')
})
