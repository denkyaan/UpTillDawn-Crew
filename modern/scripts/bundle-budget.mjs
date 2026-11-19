#!/usr/bin/env node
// Objective, reproducible static-bundle guard for the local-first candidate.
// This measures COMPRESSED static bytes, not runtime CPU or RLS safety.
import {readFile,readdir} from "node:fs/promises"
import {join,resolve} from "node:path"
import {gzipSync} from "node:zlib"

const dist=resolve(import.meta.dirname,"../dist")
const files=await readdir(join(dist,"assets"))
const js=files.filter(file=>file.endsWith(".js"))
const css=files.filter(file=>file.endsWith(".css"))
const chunks=await Promise.all([...js,...css].map(async file=>{
 const source=await readFile(join(dist,"assets",file))
 return {file,raw:source.byteLength,gzip:gzipSync(source,{level:9}).byteLength}
}))
const names=chunks.map(x=>x.file)
for(const segment of ["index-","router-","events-","tasks-","chats-","finance-"]){
 if(!names.some(x=>x.startsWith(segment)))throw Error("Missing lazy-build chunk: "+segment)
}
const initial=chunks.filter(x=>/^(index-|router-|rolldown-runtime-|.*\.css$)/.test(x.file))
const initialGzip=initial.reduce((n,x)=>n+x.gzip,0)
const maxInitialGzip=128*1024
// The public auth route includes Main's complete translation catalog and exact
// stylesheet. Measure it explicitly instead of hiding it behind a lazy import.
const authChunks=chunks.filter(x=>x.file.startsWith("original-auth-"))
if(authChunks.length!==1)throw Error("Original Main authentication chunk missing")
const authRouteGzip=initialGzip+authChunks[0].gzip
if(authRouteGzip>350*1024)throw Error("Public auth route exceeded 350 KiB gzip: "+authRouteGzip)
const lazy=chunks.filter(x=>/^(events-|tasks-|chats-|finance-)/.test(x.file))
const tooHeavy=lazy.find(x=>x.gzip>40*1024)
const html=await readFile(join(dist,"index.html"),"utf8")
if(html.includes("/_next/")||html.includes("__NEXT_DATA__"))throw Error("Next.js runtime leaked into Vite SPA")
if(initialGzip>maxInitialGzip)throw Error("Initial local-first bundle exceeded 128 KiB gzip: "+initialGzip)
if(tooHeavy)throw Error("Oversized lazy module "+tooHeavy.file+": "+tooHeavy.gzip)
console.log(JSON.stringify({
 initialGzipBytes:initialGzip,initialGzipKiB:Number((initialGzip/1024).toFixed(1)),
 maxInitialGzipKiB:maxInitialGzip/1024,allChunks:chunks,
 authRouteGzipBytes:authRouteGzip,maxAuthRouteGzipKiB:350,
 staticNavigation:true,workerRuntimeParity:"unverified"
},null,2))
