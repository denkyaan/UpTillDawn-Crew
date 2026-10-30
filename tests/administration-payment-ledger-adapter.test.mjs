import test from 'node:test'
import assert from 'node:assert/strict'
import {euroToCents,reconcileStoredLedger} from '../lib/administration/payment-ledger-adapter.ts'
test('exact decimal conversion',()=>{assert.equal(euroToCents('100.01'),10001);assert.equal(euroToCents('0.09'),9);assert.equal(euroToCents(12.5),1250)})
test('rejects malformed monetary values',()=>{for(const value of ['1.999','-1','1e3','1,20',null,Infinity])assert.throws(()=>euroToCents(value))})
test('reconciles persisted records',()=>{const result=reconcileStoredLedger([{id:'a',gross_amount:'100.01',status:'issued',currency:'EUR'}],[{id:'p',document_id:'a',amount:'100.01'}]);assert.equal(result.balanced,true)})
test('rejects invalid persisted amount',()=>assert.throws(()=>reconcileStoredLedger([{id:'a',gross_amount:'0.001',status:'issued',currency:'EUR'}],[])))
