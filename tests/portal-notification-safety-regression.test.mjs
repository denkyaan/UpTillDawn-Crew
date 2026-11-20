import test from 'node:test'
import assert from 'node:assert/strict'
import {safeNotificationPath} from '../lib/portal-access.ts'

test('shared notification URLs reject protocol-relative and encoded traversal',()=>{
 for(const target of [null,42,'https://example.com','//example.com','/path/%2e%2e/admin','/path/%2Fadmin','/path/%5cadmin','/path/\\admin','/path/\u0000admin']){
  assert.equal(safeNotificationPath(target),'/notifications')
 }
})
test('ordinary same-origin relative notification routes remain supported',()=>{
 assert.equal(safeNotificationPath('/notifications?tab=unread'),'/notifications?tab=unread')
 assert.equal(safeNotificationPath('/portals/administration'),'/portals/administration')
})
