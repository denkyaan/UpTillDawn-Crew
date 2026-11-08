import test from 'node:test'
import assert from 'node:assert/strict'
import {localDateInputValue,localDateInputLabel} from '../lib/date-input.ts'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {runInNewContext} from 'node:vm'
import ts from 'typescript'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

test('stored UTC values render in the requested summer and winter offsets without mutating the instant',()=>{
 assert.equal(localDateInputValue('2026-07-04T18:15:00.000Z',-120),'2026-07-04T20:15')
 assert.equal(localDateInputValue('2026-12-04T18:15:00.000Z',-60),'2026-12-04T19:15')
 assert.equal(localDateInputValue('2026-07-04T18:15:00.000Z',0),'2026-07-04T18:15')
})
test('offset conversion handles date boundaries and half-hour time zones',()=>{
 assert.equal(localDateInputValue('2026-07-04T23:45:00Z',-120),'2026-07-05T01:45')
 assert.equal(localDateInputValue('2026-07-04T02:15:00Z',300),'2026-07-03T21:15')
 assert.equal(localDateInputValue('2026-07-04T18:15:00Z',-330),'2026-07-04T23:45')
})
test('invalid values cannot throw or generate a hidden invalid date',()=>{
 for(const iso of ['','not a date','999999999999999999'])assert.equal(localDateInputValue(iso,0),'')
 assert.equal(localDateInputValue('2026-07-04T18:15:00Z',Infinity),'')
})
test('registration deadlines have their own field label',()=>{
 assert.equal(localDateInputLabel('registration_deadline'),'Aanmelddeadline')
 assert.equal(localDateInputLabel('default_shift_end'),'Einde')
 assert.equal(localDateInputLabel('start_at'),'Begin')
})

test('server rendering is independent of the server time zone and retains the stored UTC value',()=>{
 const compiled=ts.transpileModule(readFileSync('components/crew/date-input.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
 const exported={exports:{}},require=createRequire(import.meta.url)
 runInNewContext(compiled,{module:exported,exports:exported.exports,Date,require:name=>name==='@/lib/date-input'?{localDateInputValue,localDateInputLabel}:require(name)})
 const original=process.env.TZ,instant='2026-07-04T18:15:00.000Z'
 try{
  const output=[]
  for(const timezone of ['UTC','Europe/Brussels']){
   process.env.TZ=timezone
   output.push(renderToStaticMarkup(React.createElement(exported.exports.DateInput,{name:'start',initial:instant})))
  }
  assert.equal(output[0],output[1])
  assert.ok(output[0].includes('value="2026-07-04T18:15"'))
  assert.ok(output[0].includes('name="start" value="'+instant+'"'))
 }finally{if(original===undefined)delete process.env.TZ;else process.env.TZ=original}
})
