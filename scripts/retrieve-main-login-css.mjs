// No Actions artifact storage dependency. Fetch only the original Main Worker
// public static CSS paths, and require the actual build's SHA256 and byte size.
// Never accept a different source, stale build, HTML, credentials or redirects.
import {createHash} from 'node:crypto'
import {mkdirSync,writeFileSync} from 'node:fs'
import {resolve,dirname} from 'node:path'
import {pathToFileURL} from 'node:url'
import {execFileSync} from 'node:child_process'
const origin='https://uptilldawn-main.uptilldawn.workers.dev'
const roles=['staff','responsible','admin','promotion','administration']
const safePath=href=>typeof href==='string'&&/^\/_next\/static\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.css$/.test(href)&&!href.includes('..')
const digest=bytes=>createHash('sha256').update(bytes).digest('hex')
export async function retrieveLoginCss(manifest,sha,{fetcher=fetch,retries=3,sleep=ms=>new Promise(done=>setTimeout(done,ms))}={}){
 if(!/^[a-f0-9]{40}$/.test(sha||'')||manifest?.sha!==sha||!manifest.routes||!manifest.sheets)throw Error('LOGIN_CSS_MANIFEST_SHA_MISMATCH')
 const routes=manifest.routes
 if(Object.keys(routes).length!==roles.length)throw Error('LOGIN_CSS_ROUTE_SCOPE')
 const paths=new Set()
 for(const role of roles){
  const hrefs=routes['/login/'+role]
  if(!Array.isArray(hrefs)||!hrefs.length||new Set(hrefs).size!==hrefs.length||!hrefs.every(safePath))throw Error('LOGIN_CSS_INVALID_ROUTE')
  for(const href of hrefs)paths.add(href)
 }
 if(!paths.size||paths.size>32||Object.keys(manifest.sheets).length!==paths.size)throw Error('LOGIN_CSS_SHEET_SCOPE')
 let total=0
 for(const href of paths){
  const entry=manifest.sheets[href]
  if(!entry||!/^[a-f0-9]{64}$/.test(entry.sha256)||!Number.isSafeInteger(entry.bytes)||entry.bytes<1||entry.bytes>2*1024*1024)throw Error('LOGIN_CSS_INVALID_DIGEST')
  total+=entry.bytes
 }
 if(total>4*1024*1024)throw Error('LOGIN_CSS_SIZE_LIMIT')
 const sheets={}
 for(const href of paths){
  const expected=manifest.sheets[href]
  let last='unavailable'
  for(let attempt=1;attempt<=retries;attempt++){
   try{
    const response=await fetcher(origin+href,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000),headers:{Accept:'text/css'}})
    if(!response.ok)throw Error('HTTP_'+response.status)
    if(!(response.headers.get('content-type')||'').toLowerCase().startsWith('text/css'))throw Error('CONTENT_TYPE')
    if(!response.body)throw Error('EMPTY_BODY')
    const reader=response.body.getReader()
    const parts=[];let length=0
    try{
     while(true){
      const {done,value}=await reader.read()
      if(done)break
      length+=value.byteLength
      if(length>expected.bytes)throw Error('BYTE_LENGTH')
      parts.push(Buffer.from(value))
     }
    }finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
    const bytes=Buffer.concat(parts,length)
    if(bytes.length!==expected.bytes||digest(bytes)!==expected.sha256)throw Error('DIGEST_MISMATCH')
    const css=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)
    if(!Buffer.from(css,'utf8').equals(bytes))throw Error('INVALID_UTF8')
    sheets[href]=css
    break
   }catch(error){
    last=String(error?.message||'unavailable').replace(/[^A-Za-z0-9_ -]/g,'').slice(0,80)
    if(attempt<retries)await sleep(attempt*1000)
   }
  }
  if(!Object.hasOwn(sheets,href))throw Error('LOGIN_CSS_RETRIEVE_FAILED '+href+' '+last)
 }
 return {sha,sheets,routes}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const sha=process.env.VALIDATED_SHA||''
 if(sha!==execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim())throw Error('LOGIN_CSS_WRONG_CHECKOUT')
 const manifest=JSON.parse(process.env.MAIN_LOGIN_CSS_MANIFEST||'null')
 const payload=await retrieveLoginCss(manifest,sha)
 const path=resolve('main-login-css-artifact/main-login-css.json')
 mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify(payload))
 console.log('Verified '+Object.keys(payload.sheets).length+' public CSS sheets, byte-for-byte, for Main '+sha)
}
