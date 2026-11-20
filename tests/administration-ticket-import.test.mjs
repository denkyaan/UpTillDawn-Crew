import test from 'node:test'
import assert from 'node:assert/strict'
import {validateTicketSalesCsv} from '../lib/administration/ticket-import.ts'
const header='external_id,event_id,quantity,gross_amount,currency,sold_at\n'
const row='A1,evt-1,2,23.45,EUR,2026-10-30T12:00:00Z\n'
test('valid import retains exact euro cents and quantity',()=>{const r=validateTicketSalesCsv(header+row,'evt-1');assert.equal(r.errors.length,0);assert.equal(r.grossCents,2345);assert.equal(r.quantity,2);assert.equal(r.rows.length,1)})
test('rejects duplicate IDs atomically',()=>{const r=validateTicketSalesCsv(header+row+row,'evt-1');assert.equal(r.rows.length,0);assert.equal(r.errors.length,1)})
test('rejects mismatched event and invalid money',()=>{assert.equal(validateTicketSalesCsv(header+row,'evt-2').rows.length,0);assert.equal(validateTicketSalesCsv(header+row.replace('23.45','23.456'),'evt-1').rows.length,0)})
test('supports quoted commas and BOM',()=>{const r=validateTicketSalesCsv('\uFEFF'+header+row.replace('A1','"A,1"'),'evt-1');assert.equal(r.rows.length,1);assert.equal(r.rows[0].externalId,'A,1')})
test('rejects invalid header, malformed quote, row limit and non-EUR',()=>{assert.ok(validateTicketSalesCsv('bad\n','evt-1').errors.length);assert.ok(validateTicketSalesCsv(header+'"broken','evt-1').errors.length);assert.ok(validateTicketSalesCsv(header+row,'evt-1',0).errors.length);assert.ok(validateTicketSalesCsv(header+row.replace('EUR','USD'),'evt-1').errors.length)})

test('rejects empty data and invalid row limits',()=>{assert.ok(validateTicketSalesCsv(header,'evt-1').errors.length);assert.ok(validateTicketSalesCsv(header+row,'evt-1',-1).errors.length)})
test('rejects trailing garbage after quoted field',()=>{assert.ok(validateTicketSalesCsv(header+'"A"garbage,evt-1,1,1.00,EUR,2026-10-30T12:00:00Z','evt-1').errors.length)})
test('rejects formula-like external IDs',()=>{for(const id of ['=cmd','+cmd','-cmd','@cmd'])assert.ok(validateTicketSalesCsv(header+row.replace('A1',id),'evt-1').errors.length)})
test('rejects impossible calendar timestamps',()=>{assert.ok(validateTicketSalesCsv(header+row.replace('2026-10-30','2026-02-30'),'evt-1').errors.length)})
test('rejects embedded quotes outside quoted fields',()=>{assert.ok(validateTicketSalesCsv(header+row.replace('A1','A"B'),'evt-1').errors.length)})

test('rejects ambiguous quantity strings without persisting partial ticket batches',()=>{
 for(const quantity of ['00','01','0002','1e2','+2','2.0','-2']){
  const result=validateTicketSalesCsv(header+row+row.replace('A1','B2').replace(',2,',','+quantity+','),'evt-1')
  assert.ok(result.errors.length>0,quantity)
  assert.equal(result.rows.length,0,quantity)
  assert.equal(result.grossCents,0,quantity)
  assert.equal(result.quantity,0,quantity)
 }
})
test('rejects control characters in external ticket IDs',()=>{
 for(const id of ['A\tB','A\nB','A\rB','A'+String.fromCharCode(0)+'B']){
  const result=validateTicketSalesCsv(header+row.replace('A1','"'+id+'"'),'evt-1')
  assert.ok(result.errors.length>0,JSON.stringify(id))
  assert.equal(result.rows.length,0,JSON.stringify(id))
 }
})
test('accepts canonical positive quantities and preserves exact totals',()=>{
 const result=validateTicketSalesCsv(header+row+row.replace('A1','B2').replace(',2,',',3,'),'evt-1')
 assert.equal(result.errors.length,0)
 assert.equal(result.quantity,5)
 assert.equal(result.grossCents,4690)
})

test('quoted ticket IDs may end immediately before CSV delimiter',()=>{
 const result=validateTicketSalesCsv(header+row.replace('A1','"A,1"'),'evt-1')
 assert.equal(result.errors.length,0)
 assert.equal(result.rows[0].externalId,'A,1')
})
test('rejects non-delimiter bytes following a closing quote',()=>{
 for(const id of ['"A"garbage','"A" ','"A"\\t','"A""B"suffix']){
  const result=validateTicketSalesCsv(header+row.replace('A1',id),'evt-1')
  assert.ok(result.errors.length>0,id)
  assert.equal(result.rows.length,0)
 }
})
test('supports escaped double quotes within a quoted external ticket ID',()=>{
 const result=validateTicketSalesCsv(header+row.replace('A1','"A""B"'),'evt-1')
 assert.equal(result.errors.length,0)
 assert.equal(result.rows[0].externalId,'A"B')
})
test('rejects unterminated quoted CSV rows atomically',()=>{
 const result=validateTicketSalesCsv(header+row+'"broken,evt-1,1,1.00,EUR,2026-10-30T12:00:00Z','evt-1')
 assert.ok(result.errors.length>0)
 assert.equal(result.rows.length,0)
 assert.equal(result.quantity,0)
})
