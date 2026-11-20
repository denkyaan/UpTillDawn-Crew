// Read-only Main-QA acceptance AFTER both Workers deploy. The 163 source
// action handlers must be unreachable while the migration write gate is OFF.
// A documented POST read (view-data) must retain its original Main RLS denial.
const origin='https://uptilldawn-modern-main.uptilldawn.workers.dev'
if(process.env.E2E_MAIN_MODERN_QA_ORIGIN!==origin)throw Error('MODERN_MAIN_QA_EXACT_ORIGIN_REQUIRED')
const form=new FormData();form.set('_id','unknown');form.set('_args','[]')
for(const [path,body,contentType,expected] of [
 ['/api/migration/actions',form,null,503],
 ['/api/migration/view-data',JSON.stringify({id:'unknown',args:[]}),'application/json',401],
]){
 const response=await fetch(origin+path,{method:'POST',headers:{Origin:origin,'Sec-Fetch-Site':'same-origin',...(contentType?{'Content-Type':contentType}:{})},body,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)})
 if(response.status!==expected)throw Error('MAIN_SOURCE_READ_ONLY_POLICY '+path+' HTTP='+response.status+' expected='+expected)
 if(!(response.headers.get('content-type')||'').includes('application/json')||!(response.headers.get('cache-control')||'').includes('no-store'))throw Error('MAIN_SOURCE_PRIVATE_RESPONSE_HEADERS '+path)
 await response.body?.cancel()
}
console.log(JSON.stringify({originalActionWriteGateVerified:true,originalViewTransportVerified:true,anonymousReadsDenied:true,businessWrites:0,productionReady:false}))
