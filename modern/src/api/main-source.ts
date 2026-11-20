import {authResponseCookies,MAIN_AUTH_ORIGIN,type MainAuthBindings} from './main-auth.ts'
import {originalMainRoutes} from './main-routes.ts'
const origin='https://uptilldawn-modern-main.uptilldawn.workers.dev'
const qa='https://npbjrtiolqperdgljnhi.supabase.co'
const routes=originalMainRoutes.map(r=>({path:new RegExp('^'+r.pattern+'$'),methods:r.methods as readonly string[]}))
export function originalApiAllowed(path:string,method:string){return routes.some(r=>r.path.test(path)&&r.methods.includes(method))}
const reject=(status:number,code:string)=>Response.json({error:code},{status,headers:{'Cache-Control':'private, no-store'}})
/** Original protected APIs remain on Main during source migration. Only actual
 * committed route/method pairs are reachable, with the original cookie/RLS
 * checks. File uploads and streamed replies are forwarded without buffering. */
export async function forwardMainSource(request:Request,env:MainAuthBindings):Promise<Response>{
 const url=new URL(request.url)
 if(!originalApiAllowed(url.pathname,request.method))return reject(404,'not_found')
 if(url.origin!==origin||env.SUPABASE_URL!==qa||!env.MAIN_AUTH)return reject(503,'main_source_unavailable')
 const site=request.headers.get('sec-fetch-site')
 if(site&&site!=='same-origin'&&site!=='none')return reject(403,'invalid_origin')
 const mutation=!['GET','HEAD'].includes(request.method)
 if(mutation&&request.headers.get('origin')!==origin)return reject(403,'invalid_origin')
 const declared=request.headers.get('content-length'),max=64*1024*1024
 if(declared&&(!/^\d+$/.test(declared)||Number(declared)>max))return reject(413,'too_large')
 const upstream=new URL(url.pathname+url.search,MAIN_AUTH_ORIGIN)
 const headers=new Headers({Host:upstream.host,'X-Forwarded-Host':upstream.host,'X-Forwarded-Proto':'https'})
 for(const name of ['cookie','user-agent','accept','accept-language','content-type','range','if-none-match','cf-connecting-ip','cf-ipcity','cf-region','cf-ipcountry']){
  const value=request.headers.get(name);if(value)headers.set(name,value)
 }
 if(mutation){headers.set('Origin',MAIN_AUTH_ORIGIN);headers.set('Sec-Fetch-Site','same-origin')}
 let bytes=0
 const body=request.body?.pipeThrough(new TransformStream<Uint8Array,Uint8Array>({transform(chunk,controller){bytes+=chunk.byteLength;if(bytes>max)throw Error('too_large');controller.enqueue(chunk)}}))
 let response:Response
 try{response=await env.MAIN_AUTH.fetch(new Request(upstream,{method:request.method,headers,body,redirect:'manual',signal:AbortSignal.timeout(120_000),...{duplex:'half'}}))}catch{return reject(503,'main_source_unavailable')}
 const output=new Headers({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'})
 for(const name of ['content-type','content-disposition','content-range','accept-ranges','etag','content-security-policy','x-contract-sha256']){
  const value=response.headers.get(name);if(value)output.set(name,value)
 }
 const location=response.headers.get('location')
 if(location){const target=new URL(location,MAIN_AUTH_ORIGIN);output.set('Location',target.origin===MAIN_AUTH_ORIGIN?origin+target.pathname+target.search+target.hash:target.href)}
 let cookies:string[]
 try{cookies=authResponseCookies(response.headers)}catch{return reject(503,'cookie_transport_unavailable')}
 for(const cookie of cookies){if(/;\s*domain=/i.test(cookie))return reject(502,'invalid_cookie');output.append('Set-Cookie',cookie)}
 return new Response(response.body,{status:response.status,headers:output})
}
