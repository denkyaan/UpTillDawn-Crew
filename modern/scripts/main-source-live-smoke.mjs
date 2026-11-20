// Run only after both Main deployments finish: these source endpoints are
// introduced on the upstream Main Worker by the same commit as the candidate.
// No credentials or business actions; anonymous rejection precedes dispatch.
const origin='https://uptilldawn-modern-main.uptilldawn.workers.dev'
if(process.env.E2E_MAIN_MODERN_QA_ORIGIN!==origin)throw Error('MODERN_MAIN_QA_EXACT_ORIGIN_REQUIRED')
const form=new FormData();form.set('_id','unknown');form.set('_args','[]')
for(const [path,body,contentType] of [
 ['/api/migration/actions',form,null],
 ['/api/migration/view-data',JSON.stringify({id:'unknown',args:[]}),'application/json'],
]){
 const response=await fetch(origin+path,{method:'POST',headers:{Origin:origin,'Sec-Fetch-Site':'same-origin',...(contentType?{'Content-Type':contentType}:{})},body,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)})
 if(response.status!==401)throw Error('MAIN_SOURCE_ANONYMOUS_DENIAL '+path+' HTTP='+response.status)
 if(!(response.headers.get('content-type')||'').includes('application/json')||!(response.headers.get('cache-control')||'').includes('no-store'))throw Error('MAIN_SOURCE_PRIVATE_RESPONSE_HEADERS '+path)
 await response.body?.cancel()
}
console.log(JSON.stringify({originalActionTransportVerified:true,originalViewTransportVerified:true,anonymousCallersDenied:true,businessWrites:0,productionReady:false}))
