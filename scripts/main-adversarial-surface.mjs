// Repository-wide read-only inventory + bounded anonymous probes for MAIN only.
// Never issues authenticated mutations, scans external providers, or touches production.
import {readdirSync,mkdirSync,writeFileSync} from 'node:fs'
import {join,posix} from 'node:path'

const OUTPUT='test-results/main-adversarial'
mkdirSync(OUTPUT,{recursive:true})
const walk=folder=>readdirSync(folder,{withFileTypes:true})
 .flatMap(e=>e.isDirectory()?walk(join(folder,e.name)):[join(folder,e.name).replace(/\\/g,'/')])
const files=walk('app').filter(p=>/\/(page\.(tsx|ts)|route\.ts)$/.test(p))
const entries=files.map(file=>{
 const parts=file.split('/').slice(1,-1).filter(segment=>!segment.startsWith('('))
 const isDynamic=parts.some(p=>p.startsWith('['))
 const path='/'+parts.map(p=>p.startsWith('[')?'00000000-0000-4000-8000-00000000e2e1':p).join('/')
 return {file,route:path==='/'?'/':path,type:file.includes('/api/')?'api':file.endsWith('/route.ts')?'handler':'page',isDynamic}
})
const inventory={
 source:'route-file-inventory',
 note:'A source route is not automatically a functional or security acceptance test.',
 pages:entries.filter(x=>x.type==='page').length,
 api:entries.filter(x=>x.type==='api').length,
 otherHandlers:entries.filter(x=>x.type==='handler').length,
 total:entries.length,
 entries,
}
writeFileSync(OUTPUT+'/inventory.json',JSON.stringify(inventory,null,2)+'\n')
console.log('Main route inventory:',JSON.stringify({pages:inventory.pages,api:inventory.api,otherHandlers:inventory.otherHandlers,total:inventory.total}))
if(inventory.pages<90||inventory.api<50)throw Error('Critical route inventory reduction: inspect removed routes before accepting the release.')
if(process.argv.includes('--inventory-only'))process.exit(0)
if(!process.argv.includes('--probe'))throw Error('Specify --inventory-only or --probe')

const target=new URL(process.env.E2E_BASE_URL||'https://uptilldawn-main.uptilldawn.workers.dev')
if(target.origin!=='https://uptilldawn-main.uptilldawn.workers.dev'||target.pathname!=='/'||target.search||target.hash){
 throw Error('Anonymous adversarial probes are permitted on the isolated Main test Worker only.')
}
const privateApi=/^\/api\/(god\/|administration\/|admin\/|admin-assistant(?:\/|$)|uptilldawn\/|weeztix\/scan|error-reports(?:\/|$)|edit-assistant(?:\/|$))/
const checks=[],failures=[]
function record(row){
 checks.push(row)
 if(row.failure){failures.push(row);console.error('FAIL',row.method,row.route,row.failure)}
 else console.log('PASS',row.method,row.route,row.status)
}
async function probe(entry,method='GET',extra={}){
 const started=Date.now()
 const url=new URL(entry.route,target)
 const controller=new AbortController()
 const timeout=setTimeout(()=>controller.abort(),12000)
 try{
  const response=await fetch(url,{method,redirect:'manual',signal:controller.signal,
   headers:{'Accept':entry.type==='page'?'text/html':'application/json',...(extra.headers||{})},
   ...(extra.body?{body:extra.body}:{}),
  })
  // Do not read bodies: they can contain personal data, session material or secrets.
  await response.body?.cancel().catch(()=>{})
  let failure=null
  if(response.status>=500)failure='Server error on read-only probe'
  if(entry.type==='api'&&privateApi.test(entry.route)&&response.status>=200&&response.status<300){
   failure='Unauthenticated request received a successful private API response'
  }
  if(method==='POST'&&extra.crossOrigin&&response.status>=200&&response.status<300)failure='Cross-origin anonymous POST unexpectedly succeeded'
  record({method,route:entry.route,type:entry.type,file:entry.file,status:response.status,durationMs:Date.now()-started,failure})
 }catch(error){
  record({method,route:entry.route,type:entry.type,file:entry.file,status:null,durationMs:Date.now()-started,
   failure:'Network failure / timeout: '+(error instanceof Error?error.name:'unknown')})
 }finally{clearTimeout(timeout)}
}
// Low concurrency avoids turning route acceptance into an accidental load test.
const queue=[...entries]
await Promise.all(Array.from({length:3},async()=>{
 for(let entry;(entry=queue.shift())!==undefined;)await probe(entry)
}))
const crossOrigin={
 headers:{'Content-Type':'application/json',Origin:'https://malicious.example','Sec-Fetch-Site':'cross-site'},
 body:'{}',crossOrigin:true,
}
for(const route of ['/api/error-reports','/api/administration/integrations','/api/weeztix/scan','/api/god/sql']){
 await probe({route,type:'api',file:'adversarial-origin-probe',isDynamic:false},'POST',crossOrigin)
}
writeFileSync(OUTPUT+'/probe.json',JSON.stringify({
 source:'anonymous-main-surface',target:target.origin,commit:process.env.GITHUB_SHA||null,
 counts:{routes:entries.length,probes:checks.length,failures:failures.length},
 checks,failures,
 note:'Read-only anonymous route and origin probes. Not proof of authenticated business workflows or external providers.',
},null,2)+'\n')
console.log('Main anonymous probe:',JSON.stringify({routes:entries.length,checks:checks.length,failures:failures.length}))
if(failures.length)process.exitCode=1
