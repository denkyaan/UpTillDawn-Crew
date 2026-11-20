import test from 'node:test'
import assert from 'node:assert/strict'
import {notificationCanBundle,notificationBundleKey,bundleSummary} from '../lib/notification-bundling.ts'
import {notificationDeepLink,notificationPolicy} from '../lib/notification-policy.ts'
const base={id:'n1',eventId:'e1',category:'task',priority:'normal',createdAt:1000}
test('only eligible valid normal notifications may bundle',()=>{
 assert.equal(notificationCanBundle(base),true)
 assert.equal(notificationBundleKey(base),'e1:task')
 assert.equal(notificationBundleKey({...base,eventId:null}),'global:task')
 for(const patch of [{id:''},{createdAt:NaN},{createdAt:Infinity},{eventId:' '},{priority:'urgent'},{priority:'high'},{category:'incident'},{category:'help'},{category:'shift'},{category:'briefing'},{category:'planning'},{category:'unknown'}]){
  assert.equal(notificationCanBundle({...base,...patch}),false,JSON.stringify(patch))
  assert.equal(notificationBundleKey({...base,...patch}),null)
 }
})
test('bundle summaries reject malformed counts and normalize event name',()=>{
 assert.equal(bundleSummary(3,'  Main Stage '),'3 updates for Main Stage')
 for(const count of [0,-1,NaN,Infinity,1.5])assert.equal(bundleSummary(count),'1 updates')
})
test('notification deep links cannot use undefined route or blank identifier',()=>{
 assert.equal(notificationDeepLink('shift',' s 1 '),'/shifts?id=s%201')
 assert.equal(notificationDeepLink('shift',' '),'/shifts')
 assert.equal(notificationDeepLink('unknown','abc'),'/notifications?id=abc')
 assert.equal(notificationPolicy('incident').bundle,false)
 assert.equal(notificationPolicy('help').priority,'urgent')
})
