import test from 'node:test'
import assert from 'node:assert/strict'
import {reconcilePayments} from '../lib/administration/payment-reconciliation.ts'
const doc=(id,grossCents)=>({id,grossCents,currency:'EUR',status:'issued'})
const pay=(id,documentId,amountCents)=>({id,documentId,amountCents,currency:'EUR'})
test('reconciles multiple partial payments exactly',()=>{const r=reconcilePayments([doc('a',10001)],[pay('p1','a',5000),pay('p2','a',5001)]);assert.equal(r.balanced,true);assert.equal(r.lines[0].remainingCents,0)})
test('distinguishes unpaid, partial and overpaid',()=>{const r=reconcilePayments([doc('a',100),doc('b',100),doc('c',100)],[pay('p1','b',50),pay('p2','c',101)]);assert.deepEqual(r.lines.map(x=>x.state),['unpaid','partial','overpaid']);assert.equal(r.balanced,false)})
test('reports orphan payments rather than dropping them',()=>{const r=reconcilePayments([doc('a',100)],[pay('p1','other',100)]);assert.deepEqual(r.unmatchedPaymentIds,['p1']);assert.equal(r.balanced,false)})
test('rejects duplicate payment identifiers',()=>{const r=reconcilePayments([doc('a',100)],[pay('p1','a',50),pay('p1','a',50)]);assert.equal(r.errors.length,1);assert.equal(r.lines[0].paidCents,50)})
test('rejects duplicate document identifiers',()=>{assert.equal(reconcilePayments([doc('a',100),doc('a',100)],[]).errors.length,1)})
test('rejects non-integer and negative money',()=>{assert.equal(reconcilePayments([doc('a',-1)],[]).errors.length,1);assert.equal(reconcilePayments([doc('a',100)],[pay('p','a',1.5)]).errors.length,1)})
test('rejects unsupported currency',()=>{assert.equal(reconcilePayments([{...doc('a',100),currency:'USD'}],[]).errors.length,1);assert.equal(reconcilePayments([doc('a',100)],[{...pay('p','a',100),currency:'USD'}]).errors.length,1)})
test('detects safe integer overflow',()=>{const r=reconcilePayments([doc('a',100)],[pay('p1','a',Number.MAX_SAFE_INTEGER),pay('p2','a',1)]);assert.equal(r.errors.length,1)})

test('invalid documents never absorb payments into a seemingly settled balance',()=>{
 const result=reconcilePayments([{...doc('a',100),currency:'USD'}],[pay('p','a',100)])
 assert.ok(result.errors.some(error=>error.includes('Invalid document')))
 assert.ok(result.errors.some(error=>error.includes('Payment references invalid document')))
 assert.equal(result.lines[0].paidCents,0)
 assert.equal(result.balanced,false)
})
test('duplicate document IDs cannot be reconciled as separate settled records',()=>{
 const result=reconcilePayments([doc('a',100),doc('a',100)],[pay('p','a',100)])
 assert.equal(result.lines.length,2)
 assert.deepEqual(result.lines.map(line=>line.paidCents),[0,0])
 assert.equal(result.balanced,false)
})
test('missing document IDs never accept a payment',()=>{
 const result=reconcilePayments([doc('',100)],[pay('p','',100)])
 assert.equal(result.lines[0].paidCents,0)
 assert.equal(result.balanced,false)
})
test('invalid document amounts are not silently settled by valid payments',()=>{
 const result=reconcilePayments([doc('a',-100)],[pay('p','a',100)])
 assert.equal(result.lines[0].paidCents,0)
 assert.ok(result.errors.length>=2)
})
