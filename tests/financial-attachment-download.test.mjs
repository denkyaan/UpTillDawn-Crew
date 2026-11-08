import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import {safeUploadName} from '../lib/upload-security.ts'

const id='a0000000-0000-4000-8000-000000000001'
const source=ts.transpileModule(readFileSync('app/api/administration/finance/attachments/[id]/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
function harness({denied,attachment={storage_path:id+'/'+id+'.png',original_name:'proof.png'},lookupError,signError}={}){
 const calls=[],exports={}
 const db={
  from(table){calls.push(['table',table]);return{select(columns){calls.push(['select',columns]);return{eq(column,value){calls.push(['where',column,value]);return{async maybeSingle(){return{data:attachment,error:lookupError}}}}}}}},
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
test('download signs only the authorized private object for sixty seconds with a safe filename',async()=>{
 const h=harness({attachment:{storage_path:id+'/'+id+'.png',original_name:'../proof\r\n.png'}})
 const response=await h.get()
 assert.equal(response.status,303);assert.equal(response.headers.get('location'),'https://storage.test/proof?token=short-lived')
 assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('referrer-policy'),'no-referrer')
 assert.deepEqual(h.calls.filter(c=>c[0]==='where'),[['where','id',id]])
 assert.ok(h.calls.some(c=>c[0]==='bucket'&&c[1]==='admin-financial-attachments'))
 const signing=h.calls.find(c=>c[0]==='sign');assert.equal(signing[1],id+'/'+id+'.png');assert.equal(signing[2],60);assert.equal(signing[3].download,'.._proof.png')
})
test('storage errors return an unavailable response without redirecting',async()=>{
 const h=harness({signError:{message:'not found'}});const response=await h.get();assert.equal(response.status,503);assert.equal(response.headers.get('location'),null)
})
