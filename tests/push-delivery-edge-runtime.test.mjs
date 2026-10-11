import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import {safePushEndpoint,safeNotificationLink} from '../supabase/functions/push-notification/security.ts'
import {localizePushText} from '../supabase/functions/push-notification/i18n.ts'

const notification={
 id:'notice-1',user_id:'member-1',title:'Taak vraagt opvolging',body:'Je hebt een open taak',
 kind:'incident',link:'https://external.example.test/phishing',created_at:'2026-10-11T12:00:00Z'
}
const config={vapid_public_key:'test-vapid-public',vapid_private_key:'test-vapid-private',webhook_secret:'test-edge-secret'}
const subscription=(id,endpoint,locale='nl')=>({
 id,endpoint,locale,p256dh:'fixture-p256dh',auth_key:'fixture-auth'
})
function edgeHarness({notice=notification,subs=[],unread=[{kind:'incident',created_at:'2026-10-11T12:00:00Z'}],send=async()=>{}}={}){
 let handler
 const sent=[],deleted=[],queries=[],vapid=[]
 const client={
  rpc:async(name)=>({data:name==='upt_push_delivery_config'?[config]:null,error:null}),
  from(table){
   const q={
    removed:false,conditions:[],
    select(){return this},
    eq(field,value){this.conditions.push([field,value]);return this},
    is(field,value){this.conditions.push([field,value]);return this},
    limit(){return this},
    delete(){this.removed=true;return this},
    maybeSingle(){queries.push({table,conditions:this.conditions});return Promise.resolve({data:table==='crew_notifications'?notice:null,error:null})},
    then(resolve,reject){
     queries.push({table,conditions:this.conditions,removed:this.removed})
     if(this.removed)deleted.push(this.conditions.find(c=>c[0]==='id')?.[1])
     const value={data:table==='push_subscriptions'?subs:table==='crew_notifications'?unread:null,error:null}
     return Promise.resolve(this.removed?{error:null}:value).then(resolve,reject)
    }
   }
   return q
  }
 }
 const webpush={
  setVapidDetails:(...args)=>vapid.push(args),
  sendNotification:async(sub,payload,options)=>{
   sent.push({endpoint:sub.endpoint,payload:JSON.parse(payload),options})
   await send(sub)
  }
 }
 const mocks={
  'jsr:@supabase/functions-js/edge-runtime.d.ts':{},
  'npm:@supabase/supabase-js@2.106.2':{createClient:()=>client},
  'npm:web-push@3.6.7':{default:webpush},
  './security.ts':{safePushEndpoint,safeNotificationLink},
  './i18n.ts':{localizePushText},
 }
 const raw=readFileSync('supabase/functions/push-notification/index.ts','utf8')
 const compiled=ts.transpileModule(raw,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText
 vm.runInNewContext(compiled,{
  exports:{},require:(name)=>{if(Object.hasOwn(mocks,name))return mocks[name];throw Error('Unexpected Edge import: '+name)},
  Deno:{env:{get:(name)=>({SUPABASE_URL:'https://local.example.test',SUPABASE_SERVICE_ROLE_KEY:'isolated-test-key'})[name]},serve:(callback)=>{handler=callback}},
  Response,URL,console
 },{filename:'supabase/functions/push-notification/index.ts',timeout:2000})
 assert.equal(typeof handler,'function')
 const request=(id='notice-1',secret='test-edge-secret',method='POST')=>new Request('https://edge.example.test/functions/v1/push-notification',{
  method,headers:{'x-upt-push-secret':secret,'content-type':'application/json'},
  ...(method==='POST'?{body:JSON.stringify(id?{notification_id:id}:{})}:{})
 })
 return {handler,request,sent,deleted,queries,vapid}
}

test('real Edge push handler blocks wrong methods, secrets and missing ids',async()=>{
 const h=edgeHarness()
 let res=await h.handler(h.request('notice-1','test-edge-secret','GET'))
 assert.equal(res.status,405)
 res=await h.handler(h.request('notice-1','incorrect-secret'))
 assert.equal(res.status,401)
 res=await h.handler(h.request(null))
 assert.equal(res.status,400)
 assert.equal(h.sent.length,0)
})
test('real Edge push handler returns missing notification and no-subscriber results',async()=>{
 let h=edgeHarness({notice:null})
 let res=await h.handler(h.request())
 assert.equal(res.status,404)
 h=edgeHarness()
 res=await h.handler(h.request())
 assert.equal(res.status,200)
 assert.equal((await res.json()).sent,0)
})
test('real Edge push dispatch localizes each subscriber and excludes unsafe endpoints',async()=>{
 const h=edgeHarness({subs:[
  subscription('apple','https://web.push.apple.com/Q/demo','fr'),
  subscription('firefox','https://updates.push.services.mozilla.com/wpush/v2/demo','en'),
  subscription('unsafe','https://localhost/private','nl')
 ]})
 const res=await h.handler(h.request())
 assert.equal(res.status,200)
 assert.deepEqual(await res.json(),{sent:2,removed:1,failed:0})
 assert.equal(h.sent.length,2)
 assert.deepEqual(h.deleted,['unsafe'])
 assert.equal(h.sent[0].payload.title,'Une tâche nécessite un suivi')
 assert.equal(h.sent[1].payload.title,'Task needs follow-up')
 for(const item of h.sent){
  assert.equal(item.payload.link,'/notifications')
  assert.equal(item.payload.badgeCount,1)
  assert.equal(item.options.urgency,'high')
  assert.equal(item.options.TTL,86400)
 }
 assert.ok(h.queries.some(q=>q.table==='push_subscriptions'&&q.conditions.some(([key,val])=>key==='user_id'&&val==='member-1')))
})
test('real Edge push dispatch removes expired 410 endpoints and counts transient errors',async()=>{
 const h=edgeHarness({
  subs:[subscription('expired','https://web.push.apple.com/Q/expired'),subscription('retry','https://fcm.googleapis.com/fcm/send/retry')],
  send:async(sub)=>{const err=Error('delivery failed');err.statusCode=sub.endpoint.includes('expired')?410:503;throw err}
 })
 const res=await h.handler(h.request())
 assert.equal(res.status,200)
 assert.deepEqual(await res.json(),{sent:0,removed:1,failed:1})
 assert.deepEqual(h.deleted,['expired'])
})
