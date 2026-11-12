import test from 'node:test'
import assert from 'node:assert/strict'
import {readStrictJson} from '../lib/strict-json-body.ts'
import {readFileSync} from 'node:fs'

const url='https://uptilldawn-main.uptilldawn.workers.dev/api/error-reports'
const req=(body,headers={})=>new Request(url,{method:'POST',headers,body})

test('bounded error reporting accepts only a valid small UTF-8 JSON object',async()=>{
 const result=await readStrictJson(req('{"route":"/events","errorMessage":"test"}'))
 assert.equal(result.route,'/events')
 assert.equal(result.errorMessage,'test')
})

test('declared oversized error report is rejected before parsing',async()=>{
 await assert.rejects(readStrictJson(req('{"ok":true}',{'content-length':'999999'})),{message:'too_large'})
})

test('streamed oversized request cannot evade the size limit by omitting Content-Length',async()=>{
 const chunks=[new Uint8Array(12000),new Uint8Array(12000),new Uint8Array(12000)]
 const body=new ReadableStream({pull(controller){
  if(!chunks.length){controller.close();return}
  controller.enqueue(chunks.shift())
 }})
 const request=new Request(url,{method:'POST',body,duplex:'half'})
 await assert.rejects(readStrictJson(request),{message:'too_large'})
})

test('broken JSON and invalid UTF-8 produce an explicit malformed-input error',async()=>{
 for(const body of ['not-json','{"x":','{"x":,}']){
  await assert.rejects(readStrictJson(req(body)),{message:'invalid_json'})
 }
 await assert.rejects(readStrictJson(req(new Uint8Array([0xc3,0x28]))),{message:'invalid_json'})
})

test('error-report endpoint applies bounded JSON before schema validation and returns HTTP 413',()=>{
 const route=readFileSync('app/api/error-reports/route.ts','utf8')
 assert.match(route,/readStrictJson\(request\)/)
 assert.match(route,/error\.message==='too_large'\?413:400/)
 assert.doesNotMatch(route,/await request\.json\(\)/)
})
