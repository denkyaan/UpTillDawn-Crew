import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {createRequire} from 'node:module'
const root=resolve(import.meta.dirname,'../..'),require=createRequire(import.meta.url),ts=require('typescript')
const assets=['sw.js','offline.html','offline-public.html','offline-content.js','up-till-dawn-mark.webp','uptilldawn-crew-qr.svg','vendor/jsqr-1.4.0.js','vendor/jsqr-1.4.0.LICENSE']
for(const name of assets){const target=resolve(root,'modern/public',name);await mkdir(dirname(target),{recursive:true});await copyFile(resolve(root,'public',name),target)}
const js=ts.transpileModule(await readFile(resolve(root,'lib/product-copy.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
const {PRODUCT_COPY}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))
for(const [locale,copy]of Object.entries(PRODUCT_COPY)){
 const manifest={id:'/',name:copy.manifestName,short_name:'UP TILL DAWN',description:copy.manifestDescription,start_url:'/',scope:'/',display:'standalone',background_color:'#050505',theme_color:'#050505',icons:[{src:'/up-till-dawn-mark.webp',sizes:'216x216',type:'image/webp'}]}
 const content=JSON.stringify(manifest,null,2)+'\n'
 await writeFile(resolve(root,'modern/public/manifest-'+locale+'.webmanifest'),content)
 if(locale==='nl')await writeFile(resolve(root,'modern/public/manifest.webmanifest'),content)
}
