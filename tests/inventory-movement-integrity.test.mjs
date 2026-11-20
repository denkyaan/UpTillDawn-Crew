import test from 'node:test'
import assert from 'node:assert/strict'
import {applyInventoryMovement,inventoryCountsAreValid,canIssueInventory} from '../lib/inventory.ts'
const initial={id:'radio',name:'Radio',totalQuantity:10,availableQuantity:10}
test('inventory issue, return, damage, missing and recovery preserve total',()=>{
 let item=applyInventoryMovement(initial,'issue',6)
 assert.equal(item.availableQuantity,4)
 item=applyInventoryMovement(item,'return',2)
 item=applyInventoryMovement(item,'damage',1)
 item=applyInventoryMovement(item,'missing',2)
 assert.deepEqual([item.availableQuantity,item.issuedQuantity,item.damagedQuantity,item.missingQuantity],[6,1,1,2])
 item=applyInventoryMovement(item,'recover',1)
 assert.deepEqual([item.availableQuantity,item.issuedQuantity,item.damagedQuantity,item.missingQuantity],[7,1,1,1])
 assert.equal(inventoryCountsAreValid(item),true)
 assert.equal(canIssueInventory(item,7),true)
 assert.equal(initial.availableQuantity,10)
})
test('inventory movements reject overspending and malformed movements',()=>{
 assert.throws(()=>applyInventoryMovement(initial,'issue',11))
 assert.throws(()=>applyInventoryMovement(initial,'return',1))
 assert.throws(()=>applyInventoryMovement(initial,'damage',1))
 assert.throws(()=>applyInventoryMovement(initial,'missing',1))
 assert.throws(()=>applyInventoryMovement(initial,'recover',1))
 assert.throws(()=>applyInventoryMovement(initial,'issue',0))
 assert.throws(()=>applyInventoryMovement(initial,'issue',1.5))
 assert.throws(()=>applyInventoryMovement(initial,'unknown',1))
 assert.throws(()=>applyInventoryMovement({...initial,totalQuantity:11},'issue',1))
})
