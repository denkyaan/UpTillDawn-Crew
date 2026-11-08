import test from 'node:test'
import assert from 'node:assert/strict'
import {canIssueInventory,inventoryAvailability,inventoryCountsAreValid,inventoryAccountedQuantity} from '../lib/inventory.ts'
const item={id:'i1',name:'Radios',totalQuantity:10,availableQuantity:8,issuedQuantity:2,damagedQuantity:0,missingQuantity:0}
test('inventory issue accepts only available integral quantities with consistent ledger',()=>{
 assert.equal(inventoryCountsAreValid(item),true)
 assert.equal(inventoryAccountedQuantity(item),10)
 assert.equal(canIssueInventory(item,8),true)
 assert.equal(canIssueInventory(item,9),false)
 for(const quantity of [0,-1,0.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])assert.equal(canIssueInventory(item,quantity),false,String(quantity))
})
test('inventory issue rejects malformed identities and inconsistent stock counts',()=>{
 for(const patch of [{id:' '},{name:''},{totalQuantity:9},{availableQuantity:-1},{issuedQuantity:NaN},{missingQuantity:Infinity},{damagedQuantity:0.5},{totalQuantity:Number.MAX_SAFE_INTEGER+1}]){
  const candidate={...item,...patch}
  assert.equal(canIssueInventory(candidate,1),false,JSON.stringify(patch))
  if(patch.id===undefined&&patch.name===undefined)assert.equal(inventoryAvailability(candidate),'empty')
 }
})
test('inventory availability reports empty or low based on valid reconciled quantities',()=>{
 assert.equal(inventoryAvailability(item),'available')
 assert.equal(inventoryAvailability({...item,availableQuantity:2,issuedQuantity:8}),'low')
 assert.equal(inventoryAvailability({...item,availableQuantity:0,issuedQuantity:10}),'empty')
})
