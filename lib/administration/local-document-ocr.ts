/**
 * Self-hosted, client-side OCR: documents never leave the browser.
 * All worker, WASM, PDF and traineddata assets come from same-origin /vendor/ocr.
 */
import {verifiedOcrFileType} from "./cloudmersive-ocr"

export type LocalOcrLang="nld"|"fra"|"eng"|"deu"
export type LocalOcrResult={text:string;pages:number;confidence:number|null;kind:"image"|"pdf"}
type TesseractWorker={
 recognize:(image:File|HTMLCanvasElement)=>Promise<{data:{text:string;confidence:number}}>
 terminate:()=>Promise<void>
}
type TesseractGlobal={
 createWorker:(lang:string,oem:number,options:{
  workerPath:string;corePath:string;langPath:string;logger?:(message:{status:string;progress:number})=>void
 })=>Promise<TesseractWorker>
}
type PdfPage={
 getTextContent:()=>Promise<{items:Array<{str?:string}>}>
 getViewport:(options:{scale:number})=>{width:number;height:number}
 render:(options:{canvasContext:CanvasRenderingContext2D;viewport:{width:number;height:number};canvas:HTMLCanvasElement})=>{promise:Promise<void>}
}
type PdfDocument={
 numPages:number;getPage:(n:number)=>Promise<PdfPage>;destroy:()=>Promise<void>
}
type PdfModule={
 GlobalWorkerOptions:{workerSrc:string}
 getDocument:(source:{data:Uint8Array;isEvalSupported:boolean;disableAutoFetch:boolean;disableStream:boolean})=>{promise:Promise<PdfDocument>}
}
declare global {
 interface Window {Tesseract?:TesseractGlobal}
}

const asset="/vendor/ocr"
const maxBytes=5*1024*1024
const maxPages=12
const maxText=25000
const languageCodes=new Set<string>(["nld","fra","eng","deu"])
let tesseractPromise:Promise<TesseractGlobal>|null=null
let pdfPromise:Promise<PdfModule>|null=null

function addScript(src:string):Promise<void>{
 return new Promise((resolve,reject)=>{
  const script=document.createElement("script")
  script.async=true
  script.src=src
  script.onload=()=>resolve()
  script.onerror=()=>{script.remove();reject(new Error("local_ocr_assets_unavailable"))}
  document.head.appendChild(script)
 })
}
async function loadTesseract():Promise<TesseractGlobal>{
 if(window.Tesseract)return window.Tesseract
 if(!tesseractPromise)tesseractPromise=addScript(asset+"/tesseract.min.js").then(()=>{
  if(!window.Tesseract)throw new Error("local_ocr_assets_unavailable")
  return window.Tesseract
 }).catch(error=>{tesseractPromise=null;throw error})
 return tesseractPromise
}
async function loadPdf():Promise<PdfModule>{
 if(!pdfPromise){
  const path=asset+"/pdf.min.mjs"
  pdfPromise=import(/* webpackIgnore: true */ path).then((module:unknown)=>{
   const pdf=module as PdfModule
   if(!pdf?.getDocument||!pdf.GlobalWorkerOptions)throw new Error("local_pdf_unavailable")
   pdf.GlobalWorkerOptions.workerSrc=asset+"/pdf.worker.min.mjs"
   return pdf
  }).catch(error=>{pdfPromise=null;throw error})
 }
 return pdfPromise
}
function progressValue(progress:unknown){
 return typeof progress==="number"&&Number.isFinite(progress)?Math.max(0,Math.min(1,progress)):0
}
function safeResult(text:string,pages:number,values:number[],kind:"image"|"pdf"):LocalOcrResult{
 const confidence=values.length?Math.round(values.reduce((sum,n)=>sum+n,0)/values.length):null
 return {text:text.trim().slice(0,maxText),pages,confidence,kind}
}
export function isSupportedLocalOcrLanguage(value:unknown):value is LocalOcrLang{
 return typeof value==="string"&&languageCodes.has(value)
}
export async function recognizeLocally(
 file:File,language:LocalOcrLang,
 onProgress?:(progress:number,status:string)=>void,
 isCancelled?:()=>boolean,
):Promise<LocalOcrResult>{
 if(!file||file.size<8||file.size>maxBytes)throw new Error("local_ocr_invalid_file")
 if(!isSupportedLocalOcrLanguage(language))throw new Error("local_ocr_invalid_language")
 const signature=new Uint8Array(await file.slice(0,8).arrayBuffer())
 const type=verifiedOcrFileType(signature,file.type,file.name)
 if(!type)throw new Error("local_ocr_unsupported_file")
 const cancelled=()=>{if(isCancelled?.())throw new Error("local_ocr_cancelled")}
 const tesseract=await loadTesseract()
 cancelled()
 let worker:TesseractWorker|null=null
 const values:number[]=[]
 try{
  if(type!=="application/pdf"){
   onProgress?.(0,"loading")
   worker=await tesseract.createWorker(language,1,{
    workerPath:asset+"/worker.min.js",
    corePath:asset+"/core",
    langPath:asset+"/lang",
    logger:message=>onProgress?.(progressValue(message.progress),"recognizing"),
   })
   cancelled()
   const data=(await worker.recognize(file)).data
   cancelled()
   if(Number.isFinite(data.confidence))values.push(data.confidence)
   const result=safeResult(data.text||"",1,values,"image")
   if(!result.text)throw new Error("local_ocr_no_text")
   onProgress?.(1,"done")
   return result
  }
  onProgress?.(0,"reading_pdf")
  const pdfjs=await loadPdf()
  cancelled()
  const document=await pdfjs.getDocument({
   data:new Uint8Array(await file.arrayBuffer()),
   isEvalSupported:false,disableAutoFetch:true,disableStream:true,
  }).promise
  try{
   if(document.numPages<1||document.numPages>maxPages)throw new Error("local_ocr_pdf_pages_exceeded")
   const texts:string[]=[]
   for(let n=1;n<=document.numPages;n++){
    cancelled()
    onProgress?.((n-1)/document.numPages,"reading_pdf")
    const page=await document.getPage(n)
    const textItems=await page.getTextContent()
    const plain=textItems.items.map(item=>typeof item.str==="string"?item.str:"").filter(Boolean).join(" ").trim()
    // Scanned pages generally have no selectable text. Native PDF text
    // extraction is faster, exact, and does not invoke Tesseract.
    if(plain.length>=32){
     texts.push(plain)
    }else{
     if(!worker){
      worker=await tesseract.createWorker(language,1,{
       workerPath:asset+"/worker.min.js",
       corePath:asset+"/core",
       langPath:asset+"/lang",
       logger:msg=>onProgress?.(((n-1)+progressValue(msg.progress))/document.numPages,"recognizing"),
      })
     }
     cancelled()
     const base=page.getViewport({scale:1})
     const ratio=Math.min(2,Math.sqrt(2_800_000/(base.width*base.height)))
     const viewport=page.getViewport({scale:Math.max(0.5,ratio)})
     const canvas=documentGlobalCanvas()
     canvas.width=Math.max(1,Math.ceil(viewport.width))
     canvas.height=Math.max(1,Math.ceil(viewport.height))
     const context=canvas.getContext("2d",{willReadFrequently:true})
     if(!context)throw new Error("local_ocr_canvas_unavailable")
     await page.render({canvasContext:context,viewport,canvas}).promise
     cancelled()
     const scan=(await worker.recognize(canvas)).data
     texts.push(scan.text||plain)
     if(Number.isFinite(scan.confidence))values.push(scan.confidence)
     canvas.width=0;canvas.height=0
    }
    onProgress?.(n/document.numPages,"reading_pdf")
   }
   const result=safeResult(texts.join("\n\n"),document.numPages,values,"pdf")
   if(!result.text)throw new Error("local_ocr_no_text")
   onProgress?.(1,"done")
   return result
  }finally{await document.destroy()}
 }finally{
  if(worker)await worker.terminate().catch(()=>{})
 }
}
function documentGlobalCanvas(){return window.document.createElement("canvas")}
