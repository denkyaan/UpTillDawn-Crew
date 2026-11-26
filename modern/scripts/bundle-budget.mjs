#!/usr/bin/env node
// Count the actual transitive static imports in Vite's manifest, including
// shared chunks. Dynamic page/editor imports remain lazy and are reported.
import {readFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {gzipSync} from 'node:zlib'
const dist=resolve(import.meta.dirname,'../dist')
const manifest=JSON.parse(await readFile(resolve(dist,'.vite/manifest.json'),'utf8'))
function closure(entry,result=new Set()){
 if(result.has(entry))return result
 const item=manifest[entry];if(!item)throw Error('Missing manifest entry: '+entry)
 result.add(entry);for(const child of item.imports||[])closure(child,result)
 return result
}
async function size(entries){
 const files=new Set()
 for(const entry of entries){files.add(manifest[entry].file);for(const css of manifest[entry].css||[])files.add(css)}
 let bytes=0
 for(const file of files)bytes+=gzipSync(await readFile(resolve(dist,file)),{level:9}).byteLength
 return bytes
}
const initial=closure('index.html'),initialGzip=await size(initial),maxInitialGzip=128*1024
if(initialGzip>maxInitialGzip)throw Error('Initial bundle exceeded 128 KiB gzip: '+initialGzip)
const authEntries=closure('src/screens/original-auth.tsx')
const authRouteGzip=await size(authEntries)
// Count the lazy fallback as well: local login and the portal chooser actually
// load it. Do not hide CSS bytes by moving them to another chunk.
const authFallbackRouteGzip=await size(closure('src/screens/fallback-auth-styles.tsx',new Set(authEntries)))
if(authRouteGzip>350*1024||authFallbackRouteGzip>350*1024)throw Error('Original login route exceeded 350 KiB gzip: exact='+authRouteGzip+' fallback='+authFallbackRouteGzip)
const shellRouteGzip=await size(closure('main-source/components/layout/app-layout.tsx'))
if(shellRouteGzip>400*1024)throw Error('Original app shell exceeded 400 KiB gzip: '+shellRouteGzip)
const originalPages=Object.keys(manifest).filter(k=>k.startsWith('main-source/app/')&&k.endsWith('/page.tsx'))
if(originalPages.length<80)throw Error('Original Main pages missing from candidate')
const html=await readFile(resolve(dist,'index.html'),'utf8')
if(html.includes('/_next/')||html.includes('__NEXT_DATA__'))throw Error('Next runtime leaked into Vite SPA')
console.log(JSON.stringify({initialGzipBytes:initialGzip,maxInitialGzipKiB:128,authRouteGzipBytes:authRouteGzip,authFallbackRouteGzipBytes:authFallbackRouteGzip,maxAuthRouteGzipKiB:350,shellRouteGzipBytes:shellRouteGzip,maxShellRouteGzipKiB:400,originalLazyPages:originalPages.length,staticNavigation:true,workerRuntimeParity:'unverified'},null,2))
