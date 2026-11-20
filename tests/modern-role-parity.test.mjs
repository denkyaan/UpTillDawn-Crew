import test from 'node:test'
import assert from 'node:assert/strict'
import {parseIdentity,visiblePortals,isActive,safeRoute} from '../modern/src/shared/identity.ts'

const id='00000000-0000-4000-8000-000000000001'
const row=(overrides={})=>({
 id,full_name:'QA user',role:'staff',effective_role:null,
 approved:true,account_blocked:false,is_owner:false,...overrides,
})
test('verified session context refuses malformed or user-edited role objects',()=>{
 assert.equal(parseIdentity(null),null)
 assert.equal(parseIdentity({id:'any',role:'admin'}),null)
 assert.equal(parseIdentity(row({role:'head_admin'})),null)
 assert.equal(parseIdentity(row({approved:'true'})),null)
 assert.equal(parseIdentity(row({account_blocked:undefined})),null)
 assert.equal(parseIdentity(row({id:'any'})),null)
 assert.equal(parseIdentity(row({is_owner:'true'})),null)
 assert.equal(parseIdentity(row())?.id,id)
})
test('revoked or unapproved accounts are excluded from all portals; verified owner exception remains',()=>{
 const blocked=parseIdentity(row({account_blocked:true}))
 const pending=parseIdentity(row({approved:false}))
 const maker=parseIdentity(row({is_owner:true,approved:false,account_blocked:true}))
 assert.ok(blocked&&pending&&maker)
 assert.equal(isActive(blocked),false)
 assert.equal(isActive(pending),false)
 assert.equal(visiblePortals(blocked,[]).length,0)
 assert.equal(visiblePortals(pending,[]).length,0)
 assert.deepEqual(visiblePortals(maker,[]),['events','promotion','administration'])
})
test('staff cannot gain Administration by frontend labels; live approved assignment required',()=>{
 const staff=parseIdentity(row())
 assert.ok(staff)
 assert.deepEqual(visiblePortals(staff,[]),['events'])
 const supplied=[{portal:'administration',role:'administrative_staff',approved:true,revoked_at:null}]
 assert.deepEqual(visiblePortals(staff,supplied),['events','administration'])
 assert.deepEqual(visiblePortals(staff,[{...supplied[0],revoked_at:'2026-11-18T00:00:00Z'}]),['events'])
 assert.deepEqual(visiblePortals(staff,[{...supplied[0],approved:false}]),['events'])
 assert.deepEqual(visiblePortals(staff,[{...supplied[0],role:'event_staff'}]),['events'])
 const admin=parseIdentity(row({role:'admin'}))
 assert.deepEqual(visiblePortals(admin,[]),['events','promotion','administration'])
})
test('notification route hints cannot escape same-origin app',()=>{
 for(const path of ['https://evil.example','//evil.example','/../admin','/a/../god','\\evil',''])assert.equal(safeRoute(path),'/')
 assert.equal(safeRoute('/tasks'),'/tasks')
})
