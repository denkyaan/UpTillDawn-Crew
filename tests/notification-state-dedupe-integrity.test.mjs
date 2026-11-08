import test from 'node:test'
import assert from 'node:assert/strict'
import {notificationIsUnread,notificationCanMarkRead,notificationCanDismiss,unreadNotificationCount} from '../lib/notification-read-state.ts'
import {notificationsAreDuplicates,deduplicateNotifications} from '../lib/notification-dedupe.ts'
const state={notificationId:'n1',userId:'u1',deliveredAt:0,readAt:null,dismissedAt:null}
test('notification read and dismiss actions honor recorded zero timestamps',()=>{
 assert.equal(notificationIsUnread(state),true)
 assert.equal(notificationCanMarkRead(state),true)
 assert.equal(notificationCanDismiss(state),true)
 for(const patch of [{readAt:0},{dismissedAt:0}]){
  assert.equal(notificationIsUnread({...state,...patch}),false)
  assert.equal(notificationCanMarkRead({...state,...patch}),false)
 }
 assert.equal(notificationCanDismiss({...state,dismissedAt:0}),false)
 assert.equal(unreadNotificationCount([state,{...state,notificationId:'n2',readAt:0}], 'u1'),1)
})
test('notification read actions reject malformed identity and clock data',()=>{
 for(const patch of [{notificationId:' '},{userId:''},{readAt:NaN},{dismissedAt:Infinity},{deliveredAt:NaN}]){
  assert.equal(notificationIsUnread({...state,...patch}),false)
  assert.equal(notificationCanMarkRead({...state,...patch}),false)
  assert.equal(notificationCanDismiss({...state,...patch}),false)
 }
 assert.equal(unreadNotificationCount([state],' '),0)
})
test('notification deduplication requires valid fingerprints and finite windows',()=>{
 const a={userId:'u1',category:'shift',entityId:'s1',messageKey:'changed',createdAt:1000}
 const b={...a,createdAt:61000}
 assert.equal(notificationsAreDuplicates(a,b),true)
 assert.equal(notificationsAreDuplicates(a,{...b,createdAt:61001}),false)
 for(const patch of [{userId:''},{category:' '},{messageKey:''},{createdAt:NaN}]){
  assert.equal(notificationsAreDuplicates(a,{...a,...patch}),false)
 }
 for(const window of [-1,NaN,Infinity])assert.equal(notificationsAreDuplicates(a,b,window),false)
 assert.equal(deduplicateNotifications([a,b]).length,1)
})
