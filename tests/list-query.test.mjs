import test from 'node:test'
import assert from 'node:assert/strict'
import {listPage,escapeLikeSearch} from '../lib/list-query.ts'

test('URL pagination accepts actual page numbers beyond page one',()=>{
 for(const value of ['1','2','10','51','99999'])assert.equal(listPage(value),Number(value))
 assert.equal(listPage('100000'),100000)
 assert.equal(listPage('999999'),100000)
 assert.equal(listPage('10000',9999),9999)
})

test('pagination rejects malformed, repeated and coercible query values',()=>{
 for(const value of [undefined,null,[],['2'],2,'','0','-1','01',' 2','2 ','1.5','2e1','0x10','Infinity','1000000','2\\d','2/3']){
  assert.equal(listPage(value),1,String(value))
 }
})

test('literal name searches escape each LIKE metacharacter exactly once',()=>{
 assert.equal(escapeLikeSearch('Crew 100%_ready\\today'),'Crew 100\\%\\_ready\\\\today')
 assert.equal(escapeLikeSearch('Acid & Dawn'),'Acid & Dawn')
 assert.equal(escapeLikeSearch('%'),String.raw`\%`)
 assert.equal(escapeLikeSearch('_'),String.raw`\_`)
 assert.equal(escapeLikeSearch('\\'),String.raw`\\`)
 assert.equal(escapeLikeSearch(''), '')
})
