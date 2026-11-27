import test from 'node:test'
import assert from 'node:assert/strict'
import {requestHasSameOrigin,authRequestOrigin} from '../lib/request-origin.ts'

const request=(url,origin,headers={})=>new Request(url,{headers:{...(origin===undefined?{}:{origin}),...headers}})

test('same-origin uploads work when Next.js uses an internal localhost URL',()=>{
 assert.equal(requestHasSameOrigin(request('http://localhost:3000/api/import','http://127.0.0.1:3000',{host:'127.0.0.1:3000'})),true)
 assert.equal(requestHasSameOrigin(request('https://internal.worker/api/import','https://crew.uptilldawn.workers.dev',{host:'crew.uptilldawn.workers.dev'})),true)
 assert.equal(requestHasSameOrigin(request('https://crew.uptilldawn.workers.dev/api/import','https://crew.uptilldawn.workers.dev')),true)
})

test('cross-origin and missing-origin mutations remain denied',()=>{
 for(const origin of [undefined,'null','https://foreign.invalid','http://crew.uptilldawn.workers.dev','https://crew.uptilldawn.workers.dev:444']){
  assert.equal(requestHasSameOrigin(request('https://internal.worker/api/import',origin,{host:'crew.uptilldawn.workers.dev'})),false,String(origin))
 }
 assert.equal(requestHasSameOrigin(request('http://localhost:3000/api/import','http://localhost:3000',{host:'127.0.0.1:3000'})),false)
})

test('forwarded and malformed host headers cannot grant an origin',()=>{
 assert.equal(requestHasSameOrigin(request('https://crew.uptilldawn.workers.dev/api/import','https://foreign.invalid',{'x-forwarded-host':'foreign.invalid','x-forwarded-proto':'https'})),false)
 for(const host of ['crew.uptilldawn.workers.dev/other','crew.uptilldawn.workers.dev@foreign.invalid','crew.uptilldawn.workers.dev,foreign.invalid','crew.uptilldawn.workers.dev?other','crew.uptilldawn.workers.dev\\foreign.invalid']){
  assert.equal(requestHasSameOrigin(request('https://internal.worker/api/import','https://crew.uptilldawn.workers.dev',{host})),false,host)
 }
})

test('authentication validates configured canonical origin and real Host for internal Next URLs',()=>{
 const canonical='http://127.0.0.1:3000'
 const internal='http://localhost:3000/api/auth/portal-login'
 const host={host:'127.0.0.1:3000','sec-fetch-site':'same-origin'}
 assert.equal(authRequestOrigin(request(internal,canonical,host),canonical),canonical)
 assert.equal(authRequestOrigin(request(internal,canonical,host),canonical+'/'),canonical)
 for(const configured of [undefined,'http://localhost:3000',canonical+'/path'])assert.equal(authRequestOrigin(request(internal,canonical,host),configured),null)
 for(const site of ['cross-site','same-site'])assert.equal(authRequestOrigin(request(internal,canonical,{...host,'sec-fetch-site':site}),canonical),null)
 for(const origin of [undefined,'null','http://localhost:3000','http://127.0.0.1:4000'])assert.equal(authRequestOrigin(request(internal,origin,host),canonical),null)
 assert.equal(authRequestOrigin(request(internal,canonical,{'x-forwarded-host':'127.0.0.1:3000'}),canonical),null)
 assert.equal(authRequestOrigin(request(internal,canonical,{host:'127.0.0.1:3000,foreign.invalid'}),canonical),null)
 const live='https://crew.uptilldawn.workers.dev'
 assert.equal(authRequestOrigin(request(live+'/api/auth/portal-login',live),live),live)
 assert.equal(authRequestOrigin(request(live+'/api/auth/portal-login','https://foreign.invalid',{host:'foreign.invalid'}),live),null)
})
