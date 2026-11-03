import test from 'node:test'
import assert from 'node:assert/strict'
import {validateTicketSalesSummary} from '../lib/administration/ticket-sales-summary.ts'
const row=(overrides={})=>({event_id:'123e4567-e89b-42d3-a456-426614174000',source:'eventix',sale_rows:'2',quantity:'3',gross_cents:'1500',...overrides})
test('accepts valid stored ticket summary records',()=>{assert.equal(validateTicketSalesSummary([row()]),true);assert.equal(validateTicketSalesSummary([]),true)})
test('rejects malformed IDs, nonnumeric values and oversized totals',()=>{
 for(const value of [row({event_id:'bad'}),row({gross_cents:'-1'}),row({gross_cents:'1.5'}),row({gross_cents:'9007199254740992'}),row({source:''}),row({quantity:3}),null]){
  assert.equal(validateTicketSalesSummary([value]),false)
 }
})
test('rejects invalid RPC shapes and oversized datasets',()=>{
 assert.equal(validateTicketSalesSummary(null),false)
 assert.equal(validateTicketSalesSummary({}),false)
 assert.equal(validateTicketSalesSummary(Array.from({length:10001},()=>row())),false)
})
