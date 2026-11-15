/**
 * Publish ONLY Next.js build-time, anonymous login pages as Cloudflare Assets.
 * Authenticated pages and admin login remain dynamic, behind their existing
 * authorization. Static HTML is copied only when Next's prerender manifest
 * proves the exact route is generated at build time.
 *
 * This is deliberately Main-only: invoked only by Deploy main, never by the
 * package's standard build:cloudflare command used by production.
 */
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync,copyFileSync} from 'node:fs'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import nextConfig from '../next.config.mjs'

export const PUBLIC_LOGIN_ROUTES=['/login/staff','/login/responsible','/login/promotion','/login/administration']

function collectHtml(directory){
 if(!existsSync(directory))throw Error('Next server build output missing: '+directory)
 const result=[]
 function walk(dir){
  for(const item of readdirSync(dir,{withFileTypes:true})){
   const full=path.join(dir,item.name)
   if(item.isDirectory())walk(full)
   else if(item.isFile()&&item.name.endsWith('.html'))result.push(full)
  }
 }
 walk(directory)
 return result
}

export async function publishLoginAssets({nextRoot='.next',assetRoot='.open-next/assets'}={}){
 const manifestFile=path.join(nextRoot,'prerender-manifest.json')
 const manifest=JSON.parse(readFileSync(manifestFile,'utf8'))
 const htmlFiles=collectHtml(path.join(nextRoot,'server','app'))
 const prepared=[]
 for(const route of PUBLIC_LOGIN_ROUTES){
  const entry=manifest.routes?.[route]
  if(!entry||entry.initialRevalidateSeconds!==false)
   throw Error('Public login route is not an immutable prerendered page: '+route)
  const suffix=route+'.html'
  const candidates=htmlFiles.filter(file=>file.replaceAll('\\','/').endsWith(suffix))
  if(candidates.length!==1)throw Error('Expected exactly one prerendered HTML for '+route+', found '+candidates.length)
  const html=readFileSync(candidates[0],'utf8')
  const portal=route.split('/')[2]
  if(!html.includes('<html')||!html.includes('data-login-hydrated')||
      !html.includes('name="portal"')||!html.includes('value="'+portal+'"'))
   throw Error('Prerendered HTML is not the expected anonymous '+portal+' login shell')
  if(html.includes('supabase_service_role')||html.includes('SUPABASE_SERVICE_ROLE'))
   throw Error('Refusing to publish HTML containing privileged server keys')
  prepared.push({source:candidates[0],route,bytes:Buffer.byteLength(html)})
 }
 // No partial publication if any SSG route is missing or fails inspection.
 for(const item of prepared){
  const target=path.join(assetRoot,item.route.slice(1)+'.html')
  mkdirSync(path.dirname(target),{recursive:true})
  copyFileSync(item.source,target)
 }
 // Next.js response headers do not apply to Cloudflare's direct Static Assets.
 // Mirror the existing security policy for these four public pages.
 const nextHeaders=await nextConfig.headers()
 const common=nextHeaders.find(group=>group.source==='/:path*')?.headers
 if(!common?.length||!common.some(header=>header.key==='Content-Security-Policy'))
  throw Error('Missing shared security policy: cannot publish static login pages')
 const ruleHeaders=[
  ...common,
  {key:'Cache-Control',value:'no-store'},
  {key:'X-UpTillDawn-Static-Login',value:'1'},
 ]
 const headerPath=path.join(assetRoot,'_headers')
 let existing=existsSync(headerPath)?readFileSync(headerPath,'utf8').trimEnd()+'\n':''
 for(const item of prepared){
  existing+=item.route+'\n'
  for(const header of ruleHeaders)existing+='  '+header.key+': '+header.value+'\n'
 }
 writeFileSync(headerPath,existing)
 console.log('Published '+prepared.length+' anonymous Main login assets; role/auth checks and POST Server Actions are unchanged')
 for(const item of prepared)console.log('Static Main login '+item.route+': '+item.bytes+' bytes')
 return prepared
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 publishLoginAssets().catch(error=>{console.error('Static Main login publication failed closed: '+error.message);process.exitCode=1})
}
