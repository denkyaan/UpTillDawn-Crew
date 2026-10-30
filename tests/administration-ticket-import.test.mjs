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
