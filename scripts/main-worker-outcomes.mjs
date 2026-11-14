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
    quantiles { cpuTimeP99 }
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
 for(const row of rows){
  if(row?.dimensions?.scriptName!=='uptilldawn-main')continue
  const name=String(row?.dimensions?.status||'unknown').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,48)
  statusCounts.set(name,(statusCounts.get(name)||0)+Math.max(0,Number(row?.sum?.requests)||0))
 }
 const summary=[...statusCounts.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([k,v])=>k+'='+v).join(', ')
 console.log('CLOUDFLARE_MAIN_OUTCOMES last90min: '+(summary||'no matching invocations'))
 const cpu=statusCounts.get('exceededCpu')||0,memory=statusCounts.get('exceededMemory')||0
 if(cpu||memory)console.log('::warning::Main Worker resource exhaustion measured: exceededCpu='+cpu+', exceededMemory='+memory)
 if(rows.length===1000)console.log('::warning::Worker analytics query hit 1000-row limit; outcomes may be incomplete')
 const {appendFileSync}=await import('node:fs')
 if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,
  '\n### Main Worker resource outcomes (read-only, last 90min)\n- Worker: uptilldawn-main\n- Status counts: '+(summary||'none')+'\n- Production worker not queried\n')
}catch{
 console.log('CLOUDFLARE_MAIN_OUTCOMES unavailable: analytics endpoint not reachable; verify Account Analytics Read permission')
}
