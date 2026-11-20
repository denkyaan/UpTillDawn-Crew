import test from 'node:test'
import assert from 'node:assert/strict'
import {validateTicketSalesSummary,ticketSalesTotals,ticketSalesByEvent,formatTicketEuro} from '../lib/administration/ticket-sales-summary.ts'
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

test('aggregates multiple event channels without floating point rounding',()=>{
 const rows=[row({gross_cents:'9007199254740991',quantity:'2'}),row({gross_cents:'9007199254740991',quantity:'3'})]
 const totals=ticketSalesTotals(rows)
 assert.equal(totals.grossCents,18014398509481982n)
 assert.equal(totals.quantity,5n)
 assert.equal(totals.saleRows,4n)
})
test('formats integer cents in supported UI locales',()=>{
 assert.equal(formatTicketEuro(12345n,'nl'),'123,45 EUR')
 assert.equal(formatTicketEuro(12345n,'en'),'123.45 EUR')
 assert.equal(formatTicketEuro(5n,'de'),'0,05 EUR')
})

test('groups provider rows per event without merging different events',()=>{
 const a='123e4567-e89b-42d3-a456-426614174000'
 const b='123e4567-e89b-42d3-a456-426614174001'
 const events=ticketSalesByEvent([row({event_id:a,source:'eventix',quantity:'2',gross_cents:'1200'}),row({event_id:a,source:'sumup',quantity:'1',gross_cents:'500'}),row({event_id:b,source:'eventix',quantity:'3',gross_cents:'2000'})])
 assert.equal(events.length,2)
 assert.equal(events[0].sourceCount,2)
 assert.equal(events[0].quantity,BigInt(3))
 assert.equal(events[0].grossCents,BigInt(1700))
 assert.equal(events[1].grossCents,BigInt(2000))
})
test('repeated source rows count as one provider but retain every sale',()=>{
 const events=ticketSalesByEvent([row(),row({quantity:'4',gross_cents:'2500'})])
 assert.equal(events[0].sourceCount,1)
 assert.equal(events[0].quantity,BigInt(7))
 assert.equal(events[0].saleRows,BigInt(4))
})
