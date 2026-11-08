import test from 'node:test'
import assert from 'node:assert/strict'
import {accessiblePortals,canOpenPortal,safeNotificationPath} from '../lib/portal-access.ts'
import {administrationNotificationHref,administrationRoute} from '../lib/administration/navigation.ts'

const active={approved:true,blocked:false}
const grant=(portal,role,extra={})=>({portal,role,approved:true,revoked_at:null,...extra})

test('multi-role matrix: assignments do not leak rights across portals',()=>{
 const cases=[
  {grants:[],expected:[]},
  {grants:[grant('events','event_staff')],expected:['events']},
  {grants:[grant('events','event_responsible'),grant('promotion','promoter')],expected:['events','promotion']},
  {grants:[grant('promotion','promoter'),grant('administration','administrative_staff')],expected:['promotion','administration']},
  {grants:[grant('events','admin'),grant('administration','admin')],expected:['events','administration']},
  {grants:[grant('events','promoter'),grant('administration','event_staff')],expected:[]},
  {grants:[grant('events','event_staff',{revoked_at:'2026-11-08T12:00:00Z'}),grant('promotion','promoter')],expected:['promotion']},
 ]
 for(const {grants,expected} of cases){
  assert.deepEqual(accessiblePortals(grants,active),expected)
  for(const portal of ['events','promotion','administration'])assert.equal(canOpenPortal(portal,grants,active),expected.includes(portal))
 }
})

test('shared and administration notification routing reject hostile path encodings',()=>{
 const inputs=[
  '//evil.test','/\\evil','/portals/administration/../promotion',
  '/portals/administration/%2e%2e/promotion',
  '/portals/administration/%252e%252e/promotion',
  '/portals/administration/%252fadmin',
  '/portals/administration/%255cadmin',
  '/portals/administration/%250a',
  '/portals/administration/%0a',
  '/portals/administration/%7f',
 ]
 for(const input of inputs){
  assert.equal(safeNotificationPath(input),'/notifications',input)
  assert.equal(administrationNotificationHref(input),null,input)
 }
})

test('valid administration notification targets retain search and fragments',()=>{
 for(const [source,expected] of [
  ['/tasks?event=123#mine',administrationRoute('tasks')+'?event=123#mine'],
  ['/chat?thread=abc',administrationRoute('chat')+'?thread=abc'],
  ['/timesheets?status=open',administrationRoute('timesheets')+'?status=open'],
  ['/portals/administration/invoices/123?tab=payments',administrationRoute('invoices')+'?tab=payments'],
  ['/portals/administration/modules/./tasks?view=mine#today',administrationRoute('tasks')+'?view=mine#today'],
 ]){
  assert.equal(administrationNotificationHref(source),expected,source)
 }
 assert.equal(safeNotificationPath('/notifications?search=%252e%252e#today'),'/notifications?search=%252e%252e#today')
})
