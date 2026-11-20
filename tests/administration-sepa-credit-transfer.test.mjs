import {test} from 'node:test'
import assert from 'node:assert/strict'
import {prepareSepaCreditTransfer,ibanValid} from '../lib/administration/sepa-credit-transfer.mjs'
const input={messageId:'BATCH_1',debtorName:'UpTillDawn',debtorIban:'BE68539007547034',executionDate:'2026-11-03',transactions:[{id:'INV_1',name:'Supplier & Sons',iban:'BE68539007547034',amount:'12.34',remittance:'Invoice <1>'}]}
test('valid IBAN checksum',()=>{assert.equal(ibanValid(input.debtorIban),true);assert.equal(ibanValid('BE68539007547035'),false)})
test('produces bank approval only XML with escaped values',()=>{const r=prepareSepaCreditTransfer(input);assert.equal(r.totalCents,1234);assert.equal(r.requiresBankApproval,true);assert.match(r.xml,/Supplier &amp; Sons/);assert.match(r.xml,/Invoice &lt;1&gt;/);assert.match(r.xml,/<CtrlSum>12.34<\/CtrlSum>/)})
test('rejects duplicate payment IDs',()=>assert.throws(()=>prepareSepaCreditTransfer({...input,transactions:[...input.transactions,...input.transactions]}),/duplicate/))
test('rejects invalid account',()=>assert.throws(()=>prepareSepaCreditTransfer({...input,debtorIban:'BE000'}),/debtor/))
test('rejects invalid amount',()=>assert.throws(()=>prepareSepaCreditTransfer({...input,transactions:[{...input.transactions[0],amount:'1.999'}]}),/amount/))
test('rejects invalid date',()=>assert.throws(()=>prepareSepaCreditTransfer({...input,executionDate:'2026-02-30'}),/date/))
test('rejects empty batch',()=>assert.throws(()=>prepareSepaCreditTransfer({...input,transactions:[]}),/count/))

test('rejects XML forbidden control characters in beneficiary',()=>assert.throws(()=>prepareSepaCreditTransfer({...input,transactions:[{...input.transactions[0],name:'Supplier\u0001'}]}),/beneficiary/))
test('rejects XML forbidden control characters in remittance',()=>assert.throws(()=>prepareSepaCreditTransfer({...input,transactions:[{...input.transactions[0],remittance:'Invoice\u0000'}]}),/remittance/))
test('rejects unpaired surrogate in debtor name',()=>assert.throws(()=>prepareSepaCreditTransfer({...input,debtorName:'Company\uD800'}),/debtor/))
test('rejects whitespace-only beneficiary name',()=>assert.throws(()=>prepareSepaCreditTransfer({...input,transactions:[{...input.transactions[0],name:'  '}]}),/beneficiary/))
