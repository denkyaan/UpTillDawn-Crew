import {WorkerEntrypoint} from 'cloudflare:workers'
import {mainAuthRuntimeConfiguration,mainGeoapifyRuntimeConfiguration} from '../lib/migration/main-auth-runtime-config.ts'
import {nativeOriginalAuth} from '../modern/src/api/native-auth.ts'
import legacy from '../.open-next/worker.js'
// Keep the authoritative Main HTTP application unchanged. The named internal
// entrypoint does not call Next, render pages or provide a public HTTP API.
const paths=new Set(['/api/auth/portal-login','/api/auth/account-action','/auth/callback'])
const mainWorker={
 ...legacy,
 async fetch(request,env,ctx){
  const url=new URL(request.url)
  if(url.origin==='https://uptilldawn-main.uptilldawn.workers.dev'&&paths.has(url.pathname)&&request.method===(url.pathname==='/auth/callback'?'GET':'POST')){
   try{
    const result=await nativeOriginalAuth(request,{runtimeConfiguration:async()=>mainAuthRuntimeConfiguration(env)},'sb_publishable_zStTw3n8wZ271PehDRDvGg_rs0JOy84')
    const headers=new Headers(result.headers)
    headers.set('Cache-Control','private, no-store');headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','no-referrer');headers.set('X-Frame-Options','SAMEORIGIN');headers.set('Strict-Transport-Security','max-age=31536000; includeSubDomains')
    return new Response(result.body,{status:result.status,headers})
   }catch{return Response.json({error:'Aanmelden kon niet worden verwerkt.',code:'login_temporarily_unavailable'},{status:503,headers:{'Cache-Control':'private, no-store'}})}
  }
  return legacy.fetch(request,env,ctx)
 },
}
export default mainWorker
export class MainAuthRuntime extends WorkerEntrypoint{
 runtimeConfiguration(){return mainAuthRuntimeConfiguration(this.env)}
 geoapifyConfiguration(){return mainGeoapifyRuntimeConfiguration(this.env)}
}
