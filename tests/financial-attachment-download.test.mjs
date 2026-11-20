import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import {safeUploadName} from '../lib/upload-security.ts'

const id='a0000000-0000-4000-8000-000000000001'
const source=ts.transpileModule(readFileSync('app/api/administration/finance/attachments/[id]/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
function harness({denied,attachment={storage_path:id+'/'+id+'.png',original_name:'proof.png'},lookupError,scanStatus='clean',scanError,signError}={}){
 const calls=[],exports={}
 const db={
  from(table){calls.push(['table',table]);return{select(columns){calls.push(['select',columns]);return{eq(column,value){calls.push(['where',column,value]);return this},async maybeSingle(){return table==='admin_financial_attachments'?{data:attachment,error:lookupError}:{data:scanStatus===null?null:{status:scanStatus},error:scanError}}}}}},
  storage:{from(bucket){calls.push(['bucket',bucket]);return{async createSignedUrl(path,ttl,options){calls.push(['sign',path,ttl,options]);return{data:signError?null:{signedUrl:'https://storage.test/proof?token=short-lived'},error:signError}}}}},
 }
 vm.runInNewContext(source,{exports,Response,require(name){if(name==='@/lib/administration/access')return{administrationAccess:async()=>denied?{ok:false,status:denied}:{ok:true,db}};if(name==='@/lib/upload-security')return{safeUploadName};throw Error(name)}})
 return {get:requested=>exports.GET(new Request('https://app.test/download'),{params:Promise.resolve({id:requested??id})}),calls}
}
test('revoked or unavailable administration access cannot query or sign attachments',async()=>{
 for(const denied of [401,403,503]){const h=harness({denied});assert.equal((await h.get()).status,denied);assert.deepEqual(h.calls,[])}
})
test('invalid identities, absent objects and database failures never sign a file',async()=>{
 for(const [options,requested,status] of [[{},'../other',422],[{attachment:null},id,404],[{lookupError:{code:'XX000'}},id,503]]){
  const h=harness(options);assert.equal((await h.get(requested)).status,status);assert.ok(!h.calls.some(call=>call[0]==='sign'))
 }
})
test('pending, failed, missing, scanning and malicious verdicts block downloads before signing',async()=>{
 for(const [status,expected] of [['pending',423],['scanning',423],['scan_failed',423],[null,423],['infected',410],['suspicious',410]]){
  const h=harness({scanStatus:status});const response=await h.get()
  assert.equal(response.status,expected,String(status));assert.equal(response.headers.get('location'),null)
  assert.ok(!h.calls.some(c=>c[0]==='sign'),String(status))
 }
})
test('scanner registry outages fail closed and never issue a signed URL',async()=>{
 const h=harness({scanError:{code:'XX000'}})
 const response=await h.get()
 assert.equal(response.status,503)
 assert.equal((await response.json()).error,'scan_status_unavailable')
 assert.equal(h.calls.some(c=>c[0]==='sign'),false)
})
test('only a clean, registered private object may be signed for sixty seconds',async()=>{
 const h=harness({attachment:{storage_path:id+'/'+id+'.png',original_name:'../proof\r\n.png'}})
 const response=await h.get()
 assert.equal(response.status,303);assert.equal(response.headers.get('location'),'https://storage.test/proof?token=short-lived')
 assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('referrer-policy'),'no-referrer')
 assert.deepEqual(h.calls.filter(c=>c[0]==='where'),[['where','id',id],['where','bucket_id','admin-financial-attachments'],['where','storage_path',id+'/'+id+'.png']])
 assert.ok(h.calls.some(c=>c[0]==='bucket'&&c[1]==='admin-financial-attachments'))
 const signing=h.calls.find(c=>c[0]==='sign');assert.equal(signing[1],id+'/'+id+'.png');assert.equal(signing[2],60);assert.equal(signing[3].download,'.._proof.png')
})
test('storage errors return an unavailable response without redirecting',async()=>{
 const h=harness({signError:{message:'not found'}});const response=await h.get();assert.equal(response.status,503);assert.equal(response.headers.get('location'),null)
})
