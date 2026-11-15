// Read-only Cloudflare analytics for the isolated Main Worker, used after
// Main browser QA to distinguish exceededCpu from exceededMemory.
// It never prints tokens, individual requests, IPs, URLs, or raw response data.
const account=process.env.CLOUDFLARE_ACCOUNT_ID
const token=process.env.CLOUDFLARE_API_TOKEN
if(!/^[a-f0-9]{32}$/i.test(account||'')||!token){
 console.log('CLOUDFLARE_MAIN_OUTCOMES unavailable: account credentials not configured')
 process.exit(0)
}
const now=new Date()
const start=new Date(now.getTime()-90*60_000)
const query=`query MainWorkerOutcomes($accountTag: string, $start: string, $end: string, $script: string) {
 viewer {
  accounts(filter:{accountTag:$accountTag}) {
   workersInvocationsAdaptive(limit:1000,filter:{scriptName:$script,datetime_geq:$start,datetime_leq:$end}) {
    dimensions { status scriptName }
    sum { requests errors }
    quantiles { cpuTimeP99 memoryUsageBytesP99 }
   }
  }
 }
}`
const payload={query,variables:{accountTag:account,start:start.toISOString(),end:now.toISOString(),script:'uptilldawn-main'}}
try{
 const response=await fetch('https://api.cloudflare.com/client/v4/graphql',{
  method:'POST',
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','Accept':'application/json'},
  body:JSON.stringify(payload),signal:AbortSignal.timeout(12_000),
 })
 if(!response.ok){
  console.log('CLOUDFLARE_MAIN_OUTCOMES unavailable: analytics permission or service response ('+response.status+')')
  process.exit(0)
 }
 const parsed=await response.json()
 const rows=parsed?.data?.viewer?.accounts?.flatMap(account=>account.workersInvocationsAdaptive||[])
 if(!Array.isArray(rows)){
  console.log('CLOUDFLARE_MAIN_OUTCOMES unavailable: GraphQL analytics schema/permission')
  process.exit(0)
 }
 const statusCounts=new Map()
 // Cloudflare reports per-group CPU in microseconds and isolate memory in
 // bytes. These are the highest GROUPED P99 readings, not a global percentile.
 let cpuP99MaxUs=null,memoryP99MaxBytes=null
 for(const row of rows){
  if(row?.dimensions?.scriptName!=='uptilldawn-main')continue
  const name=String(row?.dimensions?.status||'unknown').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,48)
  const requests=Math.max(0,Number(row?.sum?.requests)||0)
  statusCounts.set(name,(statusCounts.get(name)||0)+requests)
  if(requests>0){
   const cpuP99=Number(row?.quantiles?.cpuTimeP99)
   const memoryP99=Number(row?.quantiles?.memoryUsageBytesP99)
   if(Number.isFinite(cpuP99)&&cpuP99>=0)cpuP99MaxUs=Math.max(cpuP99MaxUs??0,cpuP99)
   if(Number.isFinite(memoryP99)&&memoryP99>=0)memoryP99MaxBytes=Math.max(memoryP99MaxBytes??0,memoryP99)
  }
 }
 const summary=[...statusCounts.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([k,v])=>k+'='+v).join(', ')
 console.log('CLOUDFLARE_MAIN_OUTCOMES last90min: '+(summary||'no matching invocations'))
 const cpu=statusCounts.get('exceededCpu')||0,memory=statusCounts.get('exceededMemory')||0,other=statusCounts.get('exceededResources')||0
 const cpuP99Ms=cpuP99MaxUs===null?null:Math.round(cpuP99MaxUs/1000*100)/100
 const memoryP99MiB=memoryP99MaxBytes===null?null:Math.round(memoryP99MaxBytes/(1024*1024)*100)/100
 console.log('CLOUDFLARE_MAIN_RESOURCE_P99 last90min: grouped_cpu_ms='+(cpuP99Ms??'unavailable')+', grouped_memory_mib='+(memoryP99MiB??'unavailable'))
 if(cpu||memory||other)console.log('::warning::Main Worker runtime limit exceeded: exceededResources='+other+', exceededCpu='+cpu+', exceededMemory='+memory)
 if(memoryP99MiB!==null&&memoryP99MiB>=110)console.log('::warning::Main Worker isolate memory P99 is close to the 128 MiB limit; profile memory before adding traffic')
 if(rows.length===1000)console.log('::warning::Worker analytics query hit 1000-row limit; outcomes may be incomplete')
 const {appendFileSync}=await import('node:fs')
 if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,
  '\n### Main Worker resource outcomes (read-only, last 90min)\n- Worker: uptilldawn-main\n- Status counts: '+(summary||'none')+'\n- Maximum grouped CPU P99 (ms): '+(cpuP99Ms??'unavailable')+'\n- Maximum grouped isolate-memory P99 (MiB): '+(memoryP99MiB??'unavailable')+'\n- Production worker not queried\n')
}catch{
 console.log('CLOUDFLARE_MAIN_OUTCOMES unavailable: analytics endpoint not reachable; verify Account Analytics Read permission')
}
