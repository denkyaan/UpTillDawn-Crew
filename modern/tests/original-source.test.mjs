import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import {PassThrough} from 'node:stream'
import React from 'react'
import {renderToPipeableStream} from 'react-dom/server'
import {clientSource,pages,routePath,actionEntries,root,ts} from '../tooling/main-source.mjs'
import {encode,decode} from '../../lib/migration/wire.ts'
import {originalSearchParams} from '../src/compat/search-params.ts'
import {originalDateString,originalDateTimeFormat} from '../src/compat/server-date.ts'
import {boundedMigrationForm} from '../../lib/migration/bounded-form.ts'
import {boundedMigrationJson} from '../../lib/migration/bounded-json.ts'
const require=createRequire(import.meta.url)
const runtimeSource=ts.transpileModule(readFileSync(root+'/modern/src/original/runtime.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText.replace(/from ['"](react(?:\/jsx-runtime)?)['"]/g,(_,name)=>'from '+JSON.stringify(pathToFileURL(require.resolve(name)).href))
const {OriginalRequest,sourceView,loadSourceView}=await import('data:text/javascript;base64,'+Buffer.from(runtimeSource).toString('base64'))
async function render(element){
 return new Promise((resolve,reject)=>{
  const output=new PassThrough();let text=''
  output.on('data',chunk=>{text+=chunk});output.on('end',()=>resolve(text))
  const stream=renderToPipeableStream(element,{onAllReady(){stream.pipe(output)},onError:reject})
 })
}
test('async original views reuse suspended promises and isolate different request/identity scopes',async()=>{
 let calls=0
 const View=sourceView('fixture',async({value,children})=>{calls++;await Promise.resolve();return React.createElement('section',null,value,children)})
 const props={value:'QA staff',children:React.createElement('b',null,'original child')}
 const one=await render(React.createElement(OriginalRequest,{revision:'staff:1'},React.createElement(React.Suspense,{fallback:'pending'},React.createElement(React.Fragment,null,React.createElement(View,props),React.createElement(View,props)))))
 assert.equal(calls,1)
 assert.match(one,/QA staff/)
 assert.match(one,/<b>original child<\/b>/)
 await render(React.createElement(OriginalRequest,{revision:'admin:2'},React.createElement(React.Suspense,{fallback:'pending'},React.createElement(View,{value:'QA admin'}))))
 assert.equal(calls,2)
 assert.match(await loadSourceView(View,{value:'composed'}).then(x=>render(x)),/composed/)
})
test('existing Main pages, guards and inline actions remain source based without bundling private implementations',()=>{
 assert.ok(pages.length>=80)
 const paths=new Set(pages.map(routePath))
 for(const p of ['/admin','/settings','/events','/chat','/workplaces','/operations','/portals/administration/finance','/portals/promotion','/maker-mode','/god-mode'])assert.ok(paths.has(p),p)
 const finance=clientSource('app/(app)/portals/administration/finance/page.tsx')
 assert.match(finance,/__originalAction/)
 assert.match(finance,/createDraft/)
 assert.doesNotMatch(finance,/financialAttachmentPayload|\.upload\(|\.insert\(|node:crypto|process\.env/)
 const loading=clientSource('app/(app)/loading.tsx')
 assert.doesNotMatch(loading,/__originalView/,'loading fallbacks must render without async request context')
 assert.throws(()=>clientSource('lib/administration/integration-store.ts'),/Private server module blocked/)
 assert.throws(()=>clientSource('lib/administration/provider-user-oauth.ts'),/Private server module blocked/)
 const entries=actionEntries()
 assert.ok(entries.length>=160)
 assert.equal(new Set(entries.map(x=>x.id)).size,entries.length)
 for(const name of ['signUp','forgotPassword','resendVerificationEmail','signIn'])assert.ok(!entries.some(x=>x.id==='lib/actions/auth.ts#'+name),'Account callback gate must not be bypassed')
})
test('wire transport preserves file bytes, repeated form fields, dates, zero, false and undefined',async()=>{
 const body=new FormData(),form=new FormData();form.append('id','first');form.append('id','second');form.append('evidence',new File(['fixture bytes'],'bewijs.png',{type:'image/png'}))
 const input=[form,{date:new Date('2026-01-01T00:00:00Z'),zero:0,empty:'',yes:false,missing:undefined}]
 const wire=encode(input,body),[decoded,values]=decode(wire,body)
 assert.deepEqual(decoded.getAll('id'),['first','second'])
 assert.equal(decoded.get('evidence').name,'bewijs.png')
 assert.equal(await decoded.get('evidence').text(),'fixture bytes')
 assert.equal(values.date.toISOString(),'2026-01-01T00:00:00.000Z')
 assert.equal(values.zero,0);assert.equal(values.yes,false);assert.equal(values.missing,undefined)
 assert.throws(()=>decode(['file','unknown'],body))
 assert.throws(()=>decode(['value',{role:'admin'}],body))
 assert.throws(()=>encode(()=>{},body))
 const polluted=decode(['object',[['__proto__',['object',[['polluted',['value',true]]]]]]],body)
 assert.equal(Object.getPrototypeOf(polluted),Object.prototype)
 assert.equal({}.polluted,undefined)
})
test('private view inputs stop before oversized streaming JSON is parsed',async()=>{
 const req=new Request('https://example.invalid',{method:'POST',headers:{'Content-Type':'application/json'},body:new ReadableStream({start(c){c.enqueue(new Uint8Array(8193));c.close()}}),duplex:'half'})
 await assert.rejects(boundedMigrationJson(req),/too_large/)
})

test('bounded multipart retains exact upload bytes and refuses oversized chunks without concatenating a copy',async()=>{
 const form=new FormData();form.append('id','one');form.append('id','two');form.set('photo',new File(['fixture'],'bewijs.png',{type:'image/png'}))
 const parsed=await boundedMigrationForm(new Request('https://fixture.invalid',{method:'POST',body:form}))
 assert.deepEqual(parsed.getAll('id'),['one','two']);assert.equal(await parsed.get('photo').text(),'fixture')
 const oversized=new Request('https://fixture.invalid',{method:'POST',headers:{'content-type':'multipart/form-data; boundary=fixture'},body:new ReadableStream({start(c){c.enqueue(new Uint8Array(1025));c.close()}}),duplex:'half'})
 await assert.rejects(boundedMigrationForm(oversized,1024))
})

test('server date output remains UTC while explicit Brussels dates and client components keep their own timezone',()=>{
 const date=new Date('2026-11-19T23:30:00Z')
 assert.equal(originalDateString(date,'toLocaleString','nl-BE'),date.toLocaleString('nl-BE',{timeZone:'UTC'}))
 assert.equal(originalDateTimeFormat('nl-BE',{timeZone:'Europe/Brussels'}).format(date),new Intl.DateTimeFormat('nl-BE',{timeZone:'Europe/Brussels'}).format(date))
 assert.equal(originalDateString(date,'toLocaleTimeString',[],{hour:'2-digit',timeZone:undefined}),date.toLocaleTimeString('en-US',{hour:'2-digit',timeZone:'UTC'}))
 assert.match(clientSource('app/(app)/audit/page.tsx'),/__originalDateString/)
 assert.doesNotMatch(clientSource('app/(app)/operations/operations-client.tsx'),/__originalDateString/)
})

test('page query props preserve duplicate-value rejection and never mutate Object.prototype',()=>{
 const parsed=originalSearchParams('?token_hash=one&token_hash=two&view=all&__proto__=safe')
 assert.deepEqual(parsed.token_hash,['one','two']);assert.equal(parsed.view,'all')
 assert.equal(Object.getPrototypeOf(parsed),Object.prototype);assert.equal(parsed.__proto__,'safe')
})
