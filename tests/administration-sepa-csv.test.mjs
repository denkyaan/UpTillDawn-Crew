import test from 'node:test'
import assert from 'node:assert/strict'
import {parseSepaCsv} from '../lib/administration/sepa-csv.mjs'
test('valid CSV',()=>assert.deepEqual(parseSepaCsv('id,name,iban,amount,remittance\na,Test,BE68539007547034,10.50,Invoice'),[{id:'a',name:'Test',iban:'BE68539007547034',amount:'10.50',remittance:'Invoice'}]))
test('quoted comma',()=>assert.equal(parseSepaCsv('id,name,iban,amount,remittance\na,"Doe, Jane",BE68539007547034,10.50,"Hi, there"')[0].name,'Doe, Jane'))
test('unclosed quote rejected',()=>assert.throws(()=>parseSepaCsv('id,name,iban,amount,remittance\na,"Doe,BE68539007547034,10.50,x')))
test('missing columns rejected',()=>assert.throws(()=>parseSepaCsv('id,name,iban,amount,remittance\na,Test,BE68539007547034,10.50')))
test('extra columns rejected',()=>assert.throws(()=>parseSepaCsv('id,name,iban,amount,remittance\na,Test,BE68539007547034,10.50,x,extra')))
test('control characters rejected',()=>assert.throws(()=>parseSepaCsv('id,name,iban,amount,remittance\na,Te\u0000st,BE68539007547034,10.50,x')))
test('formula-like values remain inert data',()=>assert.equal(parseSepaCsv('id,name,iban,amount,remittance\na,"=1+1",BE68539007547034,10.50,x')[0].name,'=1+1'))
