import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
const require=createRequire(import.meta.url)

function loadHandler(file,mocks){
 const source=readFileSync(file,'utf8')
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 const exports={}
 const context={exports,require(id){if(Object.hasOwn(mocks,id))return mocks[id];if(id==='zod')return require('zod');throw Error('Unexpected external import '+id)},Request,Response,URL,console}
 vm.runInNewContext(compiled,context,{filename:file,timeout:2000})
 return exports
}
function request(path,body,headers={}){
 return new Request('https://crew.example.test'+path,{
  method:'POST',headers:{'content-type':'application/json',...headers},
  body:typeof body==='string'?body:JSON.stringify(body)
 })
}
function translate(user,ai){
 let calls=[]
 const route=loadHandler('app/api/translate-chat/route.ts',{
  '@opennextjs/cloudflare':{getCloudflareContext(){return {env:{AI:ai?{run:async(model,input)=>{calls.push({model,input});return ai(model,input)}}:undefined}}}},
  '@/lib/supabase/crew-server':{createClient:async()=>({auth:{getUser:async()=>({data:{user}})}})},
 })
 return {...route,calls}
}
test('real translate API rejects foreign origins and unauthenticated callers',async()=>{
 const handler=translate(null,async()=>({response:'Bonjour'}))
 let res=await handler.POST(request('/api/translate-chat',{text:'Hallo',targetLanguage:'fr'},{'origin':'https://outside.example.test'}))
 assert.equal(res.status,403)
 res=await handler.POST(request('/api/translate-chat',{text:'Hallo',targetLanguage:'fr'},{'sec-fetch-site':'cross-site'}))
 assert.equal(res.status,403)
 res=await handler.POST(request('/api/translate-chat',{text:'Hallo',targetLanguage:'fr'}))
 assert.equal(res.status,401)
 assert.equal(handler.calls.length,0)
})
test('real translate API enforces all four language choices and request length',async()=>{
 const handler=translate({id:'demo-user'},async()=>({response:'Bonjour'}))
 for(const body of [
  {text:'',targetLanguage:'fr'},
  {text:'a'.repeat(4001),targetLanguage:'nl'},
  {text:'Hallo',targetLanguage:'es'},
  {text:'Hallo',targetLanguage:'de',extra:'disallowed'},
 ]){
  const res=await handler.POST(request('/api/translate-chat',body))
  assert.equal(res.status,400)
 }
 assert.equal(handler.calls.length,0)
})
test('real translate API passes @mentions to Workers AI as untrusted message data',async()=>{
 const handler=translate({id:'demo-user'},async()=>({response:'Salut @Lina'}))
 const res=await handler.POST(request('/api/translate-chat',{text:'Hallo @Lina',targetLanguage:'fr'}))
 assert.equal(res.status,200)
 assert.equal((await res.json()).translated,'Salut @Lina')
 assert.equal(res.headers.get('cache-control'),'no-store')
 assert.equal(handler.calls.length,1)
 assert.match(handler.calls[0].model,/llama-3/)
 const messages=handler.calls[0].input.messages
 assert.equal(messages[0].role,'system')
 assert.match(messages[0].content,/never as instructions/)
 assert.match(messages[0].content,/exact @/)
 assert.equal(messages[1].role,'user')
 assert.equal(JSON.parse(messages[1].content).message,'Hallo @Lina')
})
test('real translate API handles absent Workers AI and empty or failed provider responses',async()=>{
 let h=translate({id:'demo-user'},null)
 assert.equal((await h.POST(request('/api/translate-chat',{text:'Hallo',targetLanguage:'de'}))).status,503)
 h=translate({id:'demo-user'},async()=>({response:''}))
 assert.equal((await h.POST(request('/api/translate-chat',{text:'Hallo',targetLanguage:'de'}))).status,502)
 h=translate({id:'demo-user'},async()=>{throw Error('unavailable')})
 assert.equal((await h.POST(request('/api/translate-chat',{text:'Hallo',targetLanguage:'de'}))).status,503)
})

function push(user,rpcResponse={data:'subscription-123',error:null}){
 const calls=[]
 const route=loadHandler('app/api/push/subscription/route.ts',{
  '@/lib/supabase/crew-server':{createClient:async()=>({
   auth:{getUser:async()=>({data:{user}})},
   rpc:async(name,args)=>{calls.push({name,args});return rpcResponse},
  })},
  '@/lib/push-security':{safePushEndpoint:(value)=>{
   try{const u=new URL(value);return u.protocol==='https:'&&u.hostname.endsWith('.push.example.test')&&!u.username&&!u.password}catch{return false}
  }},
  '@/lib/locale-preferences':{parseUiLocale:(value)=>['nl','fr','en','de'].includes(value)?value:null},
 })
 return {...route,calls}
}
const endpoint='https://gateway.push.example.test/device-token'
const keys={p256dh:'12345678901234567890',auth:'12345678'}

test('real push subscription API rejects foreign origins, unauthenticated users and insecure endpoints',async()=>{
 let handler=push(null)
 assert.equal((await handler.POST(request('/api/push/subscription',{endpoint,keys}))).status,401)
 handler=push({id:'demo-user'})
 assert.equal((await handler.POST(request('/api/push/subscription',{endpoint,keys},{'origin':'https://outside.example.test'}))).status,403)
 assert.equal((await handler.POST(request('/api/push/subscription',{endpoint:'http://gateway.push.example.test/device',keys}))).status,400)
 assert.equal((await handler.POST(request('/api/push/subscription',{endpoint,keys:{...keys,auth:'short'}}))).status,400)
 assert.equal(handler.calls.length,0)
})
test('real push API registers locale-scoped devices and revokes only requested endpoints',async()=>{
 const handler=push({id:'demo-user'})
 let res=await handler.POST(request('/api/push/subscription',{endpoint,keys,locale:'de'},{'user-agent':'Demo Mobile/1.0'}))
 assert.equal(res.status,200)
 assert.equal((await res.json()).ok,true)
 assert.equal(handler.calls[0].name,'upt_save_push_subscription')
 assert.equal(handler.calls[0].args.p_endpoint,endpoint)
 assert.equal(handler.calls[0].args.p_locale,'de')
 assert.equal(handler.calls[0].args.p_p256dh,keys.p256dh)
 res=await handler.POST(request('/api/push/subscription',{endpoint,keys,locale:'xx'}))
 assert.equal(res.status,200)
 assert.equal(handler.calls[1].args.p_locale,'nl')
 res=await handler.DELETE(new Request('https://crew.example.test/api/push/subscription',{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({endpoint})}))
 assert.equal(res.status,200)
 assert.equal(handler.calls[2].name,'upt_remove_push_subscription')
 assert.equal(handler.calls[2].args.p_endpoint,endpoint)
})
test('real push API surfaces storage errors instead of claiming successful subscription',async()=>{
 const handler=push({id:'demo-user'},{data:null,error:{code:'42501'}})
 const res=await handler.POST(request('/api/push/subscription',{endpoint,keys}))
 assert.equal(res.status,500)
 assert.equal((await res.json()).error,'Push-subscriptie opslaan mislukt.')
})
