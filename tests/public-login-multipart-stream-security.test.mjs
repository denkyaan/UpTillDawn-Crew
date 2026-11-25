import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {readBoundedFormData} from '../lib/bounded-form-data.ts'

const portalLogin=readFileSync('app/api/auth/portal-login/route.ts','utf8')
const adminLogin=readFileSync('app/api/auth/admin-login/route.ts','utf8')
const url='https://uptilldawn.example/api/auth/portal-login'
function formRequest(values={}){
 const form=new FormData()
 for(const [name,value] of Object.entries(values))form.set(name,value)
 return new Request(url,{method:'POST',body:form})
}

test('bounded multipart parser preserves valid login fields and optional portal navigation',async()=>{
 const form=await readBoundedFormData(formRequest({email:'user@example.com',password:'non-logged-secret',portal:'admin',next:'/portals'}))
 assert.equal(form.get('email'),'user@example.com')
 assert.equal(form.get('password'),'non-logged-secret')
 assert.equal(form.get('portal'),'admin')
 assert.equal(form.get('next'),'/portals')
})

test('streaming rejects an oversized login even without a Content-Length header',async()=>{
 const input=new Request(url,{method:'POST',headers:{'content-type':'multipart/form-data; boundary=t'},body:'x'.repeat(20_000)})
 assert.equal(input.headers.get('content-length'),null)
 await assert.rejects(readBoundedFormData(input,16_384),/too_large/)
})

test('declared form size is an early reject and cannot bypass stream limit',async()=>{
 const request=new Request(url,{method:'POST',headers:{'content-type':'multipart/form-data; boundary=t'},body:'x'})
 request.headers.set('content-length','20000')
 await assert.rejects(readBoundedFormData(request,16_384),/too_large/)
 const input=new Request(url,{method:'POST',headers:{'content-type':'multipart/form-data; boundary=t'},body:'x'.repeat(18_000)})
 input.headers.set('content-length','200')
 await assert.rejects(readBoundedFormData(input,16_384),/too_large/)
})

test('multipart parser rejects invalid bodies and unsupported encoding before sign-in',async()=>{
 await assert.rejects(readBoundedFormData(new Request(url,{method:'POST',headers:{'content-type':'text/plain'},body:'email=foo'})),/invalid_form/)
 await assert.rejects(readBoundedFormData(new Request(url,{method:'POST',headers:{'content-type':'multipart/form-data; boundary=bad'},body:'not-multipart'})),/invalid_form/)
})

test('both native and hydrated login APIs enforce streaming bounds before authentication',()=>{
 for(const route of [portalLogin]){
  assert.match(route,/readBoundedFormData\(request,16_384\)/)
  assert.doesNotMatch(route,/await request\.formData\(\)/)
 }
 assert.ok(portalLogin.indexOf('readBoundedFormData(request,16_384)')<portalLogin.indexOf('await signIn(form)'))
 assert.ok(adminLogin.includes('readBoundedFormData(request,16_384,true)'))
 assert.ok(adminLogin.indexOf('readBoundedFormData(request,16_384,true)')<adminLogin.indexOf('signInWithPassword'))
 assert.match(adminLogin,/origin!==new URL\(request\.url\)\.origin/)
})
