import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
const require=createRequire(import.meta.url)
const source=readFileSync('app/api/god/cloudflare-logs/route.ts','utf8')
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
class StudioError extends Error{constructor(message,status=400){super(message);this.status=status}}
function runtime({authorized=true,config,upstream}={}){
 const calls=[]
 const context={
  exports:{},
  require(name){
   if(name==='zod')return require('zod')
   if(name==='@/lib/god-studio-server')return {
    authorizeStudio:async()=>{if(!authorized)throw new StudioError('Not authorized',401);return {}},
    StudioError,studioResponse:(json,status=200)=>({status,json}),
    studioFailure:err=>({status:err instanceof StudioError?err.status:500,json:{error:err.message}}),
   }
   throw Error('Unexpected God API import: '+name)
  },
  process:{env:{CLOUDFLARE_OBSERVABILITY_CONFIG:config}},
  console:{},
  Date,AbortSignal,URL,JSON,
  fetch:async(url,params)=>{
   calls.push({url,params})
   return upstream||{status:200,ok:true,json:async()=>({
    success:true,result:{events:{events:[
     {timestamp:1762943400000,source:'main issue','$metadata':{service:'uptilldawn-main',error:'SyntaxError: broken UI'},'$workers':{scriptName:'uptilldawn-main'}},
     {timestamp:1762943400100,source:'other account service log','$metadata':{service:'another-service'},'$workers':{scriptName:'another-service'}},
     {timestamp:1762943400200,source:'production log','$metadata':{service:'uptilldawn-crew'},'$workers':{scriptName:'uptilldawn-crew'}},
    ]}},
   }) }
  },
 }
 vm.runInNewContext(code,context,{filename:'cloudflare-logs/route.ts'})
 return {GET:context.exports.GET,calls}
}
const valid=JSON.stringify({accountId:'a'.repeat(32),token:'test-observability-token-should-not-leak'})
const request=(env='main',limit=5)=>new Request('https://uptilldawn-main.uptilldawn.workers.dev/api/god/cloudflare-logs?environment='+env+'&limit='+limit)

test('God Mode Cloudflare logs cannot be read without a private Maker session',async()=>{
 const {GET,calls}=runtime({authorized:false,config:valid})
 const result=await GET(request())
 assert.equal(result.status,401)
 assert.equal(calls.length,0)
})

test('God Mode Cloudflare logs reject missing or malformed scoped secrets without remote calls',async()=>{
 for(const config of [undefined,'bad-json',JSON.stringify({token:'123',accountId:'wrong'})]){
  const {GET,calls}=runtime({config})
  const result=await GET(request())
  assert.ok([428,503].includes(result.status))
  assert.equal(calls.length,0)
 }
})

test('God Mode Cloudflare logs query is bounded, read-only, correct account and isolated per Worker',async()=>{
 const {GET,calls}=runtime({config:valid})
 const result=await GET(request())
 assert.equal(result.status,200)
 assert.equal(result.json.environment,'main')
 assert.equal(result.json.readOnly,true)
 assert.equal(result.json.logs.length,1,'Other Workers must never be exposed')
 assert.match(result.json.logs[0].message,/SyntaxError/)
 assert.doesNotMatch(JSON.stringify(result.json),/test-observability-token-should-not-leak/)
 assert.equal(calls.length,1)
 assert.equal(calls[0].url,'https://api.cloudflare.com/client/v4/accounts/'+ 'a'.repeat(32)+'/workers/observability/telemetry/query')
 const input=JSON.parse(calls[0].params.body)
 assert.equal(input.view,'events')
 assert.equal(input.dry,true)
 assert.deepEqual(JSON.parse(JSON.stringify(input.parameters.filters)),[
  {key:'$metadata.service',type:'string',operation:'eq',kind:'filter',value:'uptilldawn-main'},
 ])
 assert.ok(input.timeframe.to-input.timeframe.from===3600000)
})

test('God Mode Cloudflare logs can inspect production but never mutate it or mix it with main',async()=>{
 const {GET,calls}=runtime({config:valid})
 const result=await GET(request('production'))
 assert.equal(result.status,200)
 assert.equal(result.json.logs.length,1)
 assert.match(result.json.logs[0].source,/uptilldawn-crew/)
 assert.equal(JSON.parse(calls[0].params.body).parameters.filters[0].value,'uptilldawn-crew')
 assert.equal(calls[0].params.method,'POST','Cloudflare POST is exclusively a query; app API remains GET-only')
 assert.equal(typeof runtime({config:valid}).GET,'function')
 assert.doesNotMatch(source,/export async function POST|wrangler deploy|workers\/scripts\/.*\/upload/)
})

test('God Mode Cloudflare logs reject bad ranges and provider authentication failures',async()=>{
 const a=runtime({config:valid})
 assert.equal((await a.GET(request('staging'))).status,400)
 assert.equal((await a.GET(request('main',5000))).status,400)
 const b=runtime({config:valid,upstream:{ok:false,status:403}})
 assert.equal((await b.GET(request())).status,403)
})

test('Main deploy safely skips the optional Cloudflare read token and retains 5 workflows',()=>{
 const workflow=readFileSync('.github/workflows/deploy-main.yml','utf8')
 assert.match(workflow,/CLOUDFLARE_OBSERVABILITY_TOKEN: \$\{\{ secrets\.CLOUDFLARE_OBSERVABILITY_TOKEN \}\}/)
 assert.match(workflow,/npx wrangler secret put CLOUDFLARE_OBSERVABILITY_CONFIG --config wrangler\.main\.jsonc/)
 assert.match(workflow,/if: steps\.current-main\.outputs\.current == 'true'/)
 assert.match(workflow,/never the privileged/)
 const logs=readFileSync('components/god-mode/maker-logs.tsx','utf8')
 assert.match(logs,/\/api\/god\/cloudflare-logs\?environment=/)
 for(const token of ['cloudflareLogs','cloudflareUnavailable','kind:\x27cloudflare\x27','setCloudflareLogs'])assert.ok(logs.includes(token))
 assert.doesNotMatch(logs,/CLOUDFLARE_API_TOKEN/)
})
