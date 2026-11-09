/**
 * Explicit, free, same-origin OCR asset download for offline reuse.
 * No user documents, credentials or third-party API calls are involved.
 * A browser may still evict cached files under storage pressure.
 */
import {isSupportedLocalOcrLanguage,type LocalOcrLang} from "./administration/local-document-ocr.ts"

const CACHE="uptilldawn-ocr-v1"
const shared=[
 "manifest.json","tesseract.min.js","worker.min.js","pdf.min.mjs","pdf.worker.min.mjs",
 "core/tesseract-core-lstm.wasm.js","core/tesseract-core-lstm.wasm",
 "core/tesseract-core-simd-lstm.wasm.js","core/tesseract-core-simd-lstm.wasm",
 "core/tesseract-core-relaxedsimd-lstm.wasm.js","core/tesseract-core-relaxedsimd-lstm.wasm",
]
export async function prepareOfflineOcr(language:LocalOcrLang,onProgress?:(ready:number,total:number)=>void){
 if(!isSupportedLocalOcrLanguage(language))throw Error("offline_ocr_invalid_language")
 if(typeof window==="undefined"||!("caches" in window))throw Error("offline_ocr_cache_unavailable")
 const paths=[...shared,"lang/"+language+".traineddata.gz"]
 const cache=await caches.open(CACHE)
 let done=0
 onProgress?.(0,paths.length)
 for(let i=0;i<paths.length;i+=3){
  await Promise.all(paths.slice(i,i+3).map(async path=>{
   const url="/vendor/ocr/"+path
   const hit=await cache.match(url)
   if(!hit){
    // Same-origin only; do not redirect OCR binaries to another provider.
    const response=await fetch(url,{redirect:"error",credentials:"omit"})
    if(!response.ok||response.type==="opaque")throw Error("offline_ocr_asset_unavailable")
    await cache.put(url,response)
   }
   done++
   onProgress?.(done,paths.length)
  }))
 }
 for(const path of paths){
  if(!await cache.match("/vendor/ocr/"+path))throw Error("offline_ocr_cache_incomplete")
 }
 return paths.length
}
