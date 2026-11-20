// Prepare self-hosted browser OCR assets at build time. All document OCR
// runs on the user's device; production browsers never fetch code/models from
// external providers. Versions are pinned; no API credentials are needed.
import {mkdir,writeFile,stat} from "node:fs/promises"
import {join,dirname} from "node:path"
import {createHash} from "node:crypto"

const output="public/vendor/ocr"
const prefix="https://cdn.jsdelivr.net/npm"
const parts=[
 ["tesseract.min.js",`${prefix}/tesseract.js@7.0.0/dist/tesseract.min.js`,30000,180000],
 ["worker.min.js",`${prefix}/tesseract.js@7.0.0/dist/worker.min.js`,50000,280000],
 ["pdf.min.mjs",`${prefix}/pdfjs-dist@5.4.149/build/pdf.min.mjs`,100000,850000],
 ["pdf.worker.min.mjs",`${prefix}/pdfjs-dist@5.4.149/build/pdf.worker.min.mjs`,500000,2200000],
]
for(const stem of ["tesseract-core","tesseract-core-lstm","tesseract-core-simd","tesseract-core-simd-lstm","tesseract-core-relaxedsimd","tesseract-core-relaxedsimd-lstm"]){
 for(const suffix of [".wasm.js",".wasm"]){
  const name=stem+suffix
  parts.push(["core/"+name,`${prefix}/tesseract.js-core@7.0.0/${name}`,suffix===".wasm"?100000:10000,24000000])
 }
}
for(const language of ["nld","fra","eng","deu"]){
 parts.push(["lang/"+language+".traineddata.gz",
  `https://tessdata.projectnaptha.com/4.0.0_fast/${language}.traineddata.gz`,100000,15000000])
}

const errors=[]
async function download([name,url,min,max]){
 const file=join(output,name)
 await mkdir(dirname(file),{recursive:true})
 try{
  const existing=await stat(file)
  if(existing.size>=min&&existing.size<=max)return {name,bytes:existing.size,cached:true}
 }catch{}
 let error
 for(let attempt=1;attempt<=3;attempt++){
  try{
   const response=await fetch(url,{redirect:"follow",signal:AbortSignal.timeout(45000)})
   if(!response.ok)throw Error("HTTP "+response.status)
   const contentType=response.headers.get("content-type")||""
   if(/text\/html/i.test(contentType))throw Error("HTML instead of OCR asset")
   const data=new Uint8Array(await response.arrayBuffer())
   if(data.length<min||data.length>max)throw Error("Unexpected asset size "+data.length)
   if(name.endsWith(".gz")&&!(data[0]===31&&data[1]===139))throw Error("Invalid gzipped model")
   if(name.endsWith(".wasm")&&!(data[0]===0&&data[1]===97&&data[2]===115&&data[3]===109))throw Error("Invalid WASM header")
   await writeFile(file,data)
   return {name,bytes:data.length,sha256:createHash("sha256").update(data).digest("hex")}
  }catch(e){error=e instanceof Error?e.message:String(e)}
 }
 throw Error(name+": "+error)
}
for(let start=0;start<parts.length;start+=5){
 const result=await Promise.allSettled(parts.slice(start,start+5).map(download))
 for(let i=0;i<result.length;i++){
  if(result[i].status==="rejected")errors.push(String(result[i].reason))
  else console.log("Local OCR asset ready:",result[i].value.name,result[i].value.bytes,"bytes")
 }
}
if(errors.length)throw Error("Could not prepare self-hosted OCR assets: "+errors.join("; "))
await writeFile(join(output,"manifest.json"),JSON.stringify({name:"uptilldawn-local-ocr",versions:{tesseract:"7.0.0",core:"7.0.0",pdfjs:"5.4.149",models:"4.0.0_fast"},files:parts.map(p=>p[0])},null,2)+"\n")
console.log("Local OCR assets prepared:",parts.length)
