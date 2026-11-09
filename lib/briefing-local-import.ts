/**
 * Offline-first crew briefing import. The browser reads text, images, PDFs and
 * Office OpenXML without sending files to a third-party model or our backend.
 * Extracted content is a draft only: a manager must review it before saving.
 */
import {recognizeLocally,type LocalOcrLang} from "./administration/local-document-ocr.ts"

export type BriefingImportResult={title:string;instructions:string;images:File[]}
const MAX_FILE=20*1024*1024
const MAX_OFFICE_ENTRY=8*1024*1024
const MAX_OFFICE_TOTAL=24*1024*1024
const MAX_TEXT=25000
const MAX_IMAGES=5
const MAX_MEDIA_BYTES=10*1024*1024
type Entry={name:string;method:number;flags:number;compressed:number;uncompressed:number;offset:number}
const officeTypes:Record<string,{extension:string;prefix:string}>={
 "application/vnd.openxmlformats-officedocument.wordprocessingml.document":{extension:"docx",prefix:"word/"},
 "application/vnd.openxmlformats-officedocument.presentationml.presentation":{extension:"pptx",prefix:"ppt/"},
 "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":{extension:"xlsx",prefix:"xl/"},
}
const langs:Record<"nl"|"fr"|"en"|"de",LocalOcrLang>={nl:"nld",fr:"fra",en:"eng",de:"deu"}

function validUtf8(bytes:Uint8Array){return new TextDecoder("utf-8",{fatal:true}).decode(bytes)}
function decodedXml(value:string){
 return value.replace(/&#(x[0-9a-f]+|\d+);/gi,(_,code:string)=>{
  const number=code[0]?.toLowerCase()==="x"?parseInt(code.slice(1),16):parseInt(code,10)
  return number>=32&&number<=0x10ffff&&!(number>=0xd800&&number<=0xdfff)?String.fromCodePoint(number):""
 }).replace(/&(?:amp|lt|gt|quot|apos);/g,value=>({"&amp;":"&","&lt;":"<","&gt;":">","&quot;":'"',"&apos;":"'"}[value]||value))
}
function textNodes(xml:string){
 const result:string[]=[]
 const pattern=/<(?:w:t|a:t|t)\b[^>]*>([\s\S]*?)<\/(?:w:t|a:t|t)>/g
 for(const match of xml.matchAll(pattern))result.push(decodedXml(match[1]))
 return result.join("")
}
function documentLines(xml:string){
 const paragraphs=xml.match(/<(?:w:p|a:p)\b[^>]*>[\s\S]*?<\/(?:w:p|a:p)>/g)
 return (paragraphs||[xml]).map(textNodes).filter(value=>value.trim()).join("\n")
}
function spreadsheetLines(xml:string,strings:string[]){
 const rows=xml.match(/<row\b[^>]*>[\s\S]*?<\/row>/g)||[]
 const output:string[]=[]
 for(const row of rows){
  const cells:string[]=[]
  const cellPattern=/<c\b([^>]*)>([\s\S]*?)<\/c>/g
  for(const match of row.matchAll(cellPattern)){
   const type=/\bt="([^"]+)"/.exec(match[1])?.[1]
   const value=/<v\b[^>]*>([\s\S]*?)<\/v>/.exec(match[2])?.[1]
   const text=type==="s"&&value!==undefined?strings[Number(value)]||"":type==="inlineStr"?textNodes(match[2]):value?decodedXml(value):""
   if(text.trim())cells.push(text.trim())
  }
  if(cells.length)output.push(cells.join(" | "))
 }
 return output.join("\n")
}
function readDirectory(bytes:Uint8Array):Entry[]{
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength)
 const u16=(n:number)=>view.getUint16(n,true),u32=(n:number)=>view.getUint32(n,true)
 let eocd=-1
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){
  if(u32(i)===0x06054b50){eocd=i;break}
 }
 if(eocd<0)throw Error("Invalid Office ZIP directory")
 const count=u16(eocd+10),start=u32(eocd+16)
 if(count>5000||count===65535||start>=bytes.length||start===0xffffffff||u16(eocd+4)!==0||u16(eocd+6)!==0)throw Error("Unsafe Office ZIP")
 const entries:Entry[]=[]
 let pos=start
 for(let i=0;i<count;i++){
  if(pos+46>bytes.length||u32(pos)!==0x02014b50)throw Error("Invalid Office ZIP entry")
  const flags=u16(pos+8),method=u16(pos+10),compressed=u32(pos+20),uncompressed=u32(pos+24)
  const nameLen=u16(pos+28),extra=u16(pos+30),comment=u16(pos+32),offset=u32(pos+42)
  if(pos+46+nameLen+extra+comment>bytes.length||flags&1||![0,8].includes(method))throw Error("Unsupported Office archive")
  const name=validUtf8(bytes.subarray(pos+46,pos+46+nameLen))
  entries.push({name,method,flags,compressed,uncompressed,offset})
  pos+=46+nameLen+extra+comment
 }
 return entries
}
async function unpack(bytes:Uint8Array,entry:Entry,maxBytes:number){
 if(entry.uncompressed>maxBytes||entry.compressed>MAX_FILE)throw Error("Office entry too large")
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength)
 const p=entry.offset
 if(p+30>bytes.length||view.getUint32(p,true)!==0x04034b50)throw Error("Invalid Office local header")
 const start=p+30+view.getUint16(p+26,true)+view.getUint16(p+28,true)
 if(start>bytes.length||start+entry.compressed>bytes.length)throw Error("Truncated Office entry")
 const compressed=bytes.slice(start,start+entry.compressed)
 if(entry.method===0){
  if(compressed.length!==entry.uncompressed)throw Error("Invalid Office size")
  return compressed
 }
 const reader=new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw")).getReader()
 const chunks:Uint8Array[]=[]
 let total=0
 try{
  for(;;){
   const {done,value}=await reader.read()
   if(done)break
   total+=value.byteLength
   if(total>maxBytes||total>entry.uncompressed)throw Error("Office decompression limit")
   chunks.push(value)
  }
 }finally{await reader.cancel().catch(()=>{})}
 if(total!==entry.uncompressed)throw Error("Office entry size mismatch")
 const out=new Uint8Array(total)
 let offset=0
 for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.length}
 return out
}
function imageType(name:string,bytes:Uint8Array){
 const ext=name.split(".").pop()?.toLowerCase()
 if((ext==="jpg"||ext==="jpeg")&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return "image/jpeg"
 if(ext==="png"&&bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71)return "image/png"
 if(ext==="webp"&&validUtf8(bytes.subarray(0,4))==="RIFF"&&validUtf8(bytes.subarray(8,12))==="WEBP")return "image/webp"
 return null
}
async function officeTextAndImages(file:File):Promise<{text:string;images:File[]}>{
 const format=officeTypes[file.type]
 if(!format||!file.name.toLowerCase().endsWith("."+format.extension))throw Error("Unsupported Office file")
 const bytes=new Uint8Array(await file.arrayBuffer())
 if(bytes[0]!==80||bytes[1]!==75||bytes[2]!==3||bytes[3]!==4)throw Error("Invalid Office signature")
 const entries=readDirectory(bytes)
 const xmlEntries=entries.filter(e=>(
  format.extension==="docx"?/^word\/(document|header\d+|footer\d+)\.xml$/.test(e.name):
  format.extension==="pptx"?/^ppt\/(slides\/slide\d+|notesSlides\/notesSlide\d+)\.xml$/.test(e.name):
  /^xl\/(sharedStrings|worksheets\/sheet\d+)\.xml$/.test(e.name)
 )).slice(0,100)
 if(!xmlEntries.length)throw Error("No readable Office content")
 xmlEntries.sort((a,b)=>a.name.localeCompare(b.name,"en",{numeric:true}))
 const xmls=new Map<string,string>()
 let total=0
 for(const entry of xmlEntries){
  total+=entry.uncompressed
  if(total>MAX_OFFICE_TOTAL)throw Error("Office text too large")
  xmls.set(entry.name,validUtf8(await unpack(bytes,entry,MAX_OFFICE_ENTRY)))
 }
 const strings=Array.from((xmls.get("xl/sharedStrings.xml")||"").matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g),match=>textNodes(match[1]))
 let text=""
 for(const [name,xml] of xmls){
  if(name==="xl/sharedStrings.xml")continue
  text+=(format.extension==="xlsx"?spreadsheetLines(xml,strings):documentLines(xml))+"\n"
  if(text.length>MAX_TEXT)break
 }
 const images:File[]=[]
 let mediaTotal=0
 const imageEntries=entries.filter(e=>e.name.startsWith(format.prefix+"media/")&&e.uncompressed<=MAX_MEDIA_BYTES).slice(0,50)
 for(const entry of imageEntries){
  if(images.length>=MAX_IMAGES||mediaTotal+entry.uncompressed>20*1024*1024)break
  try{
   const data=await unpack(bytes,entry,MAX_MEDIA_BYTES)
   const mime=imageType(entry.name,data)
   if(!mime)continue
   const name=(entry.name.split("/").pop()||"image").replace(/[^a-zA-Z0-9._-]/g,"_").slice(-120)
   images.push(new File([data],name,{type:mime}))
   mediaTotal+=data.length
  }catch{ /* A damaged Office image must not discard readable text. */ }
 }
 return {text,images}
}
async function imageAsBoundedPng(file:File){
 const head=new Uint8Array(await file.slice(0,12).arrayBuffer())
 const ext=file.name.toLowerCase().split(".").pop()
 const valid=file.type==="image/webp"?imageType(file.name,head)==="image/webp":
  file.type==="image/png"?ext==="png"&&head[0]===137&&head[1]===80&&head[2]===78&&head[3]===71:
  file.type==="image/jpeg"?(ext==="jpg"||ext==="jpeg")&&head[0]===255&&head[1]===216&&head[2]===255:
  false
 if(!valid)throw Error("Invalid image signature")
 const bitmap=await createImageBitmap(file)
 try{
  if(!bitmap.width||!bitmap.height||bitmap.width*bitmap.height>32_000_000)throw Error("Image dimensions too large")
  const scale=Math.min(1,2200/Math.max(bitmap.width,bitmap.height))
  const canvas=document.createElement("canvas")
  canvas.width=Math.max(1,Math.round(bitmap.width*scale))
  canvas.height=Math.max(1,Math.round(bitmap.height*scale))
  try{
   const context=canvas.getContext("2d")
   if(!context)throw Error("Canvas unavailable")
   context.drawImage(bitmap,0,0,canvas.width,canvas.height)
   const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/png"))
   if(!blob||blob.size>MAX_FILE)throw Error("WebP conversion too large")
   return new File([blob],file.name.replace(/\.webp$/i,".png"),{type:"image/png"})
  }finally{canvas.width=0;canvas.height=0}
 }finally{bitmap.close()}
}
export function briefingDraftFromText(raw:string,filename:string):Pick<BriefingImportResult,"title"|"instructions">{
 const text=raw.replace(/\u0000/g,"").replace(/\r\n?/g,"\n").replace(/[\u0001-\u0008\u000b-\u001f\u007f]/g,"").trim().slice(0,MAX_TEXT)
 if(!text)return {title:"",instructions:""}
 const lines=text.split("\n").map(line=>line.trim()).filter(Boolean)
 const fallback=filename.replace(/\.[^.]+$/,"").replace(/[_-]+/g," ").replace(/[\u0000-\u001f]/g," ").trim().slice(0,120)
 const first=lines[0]||""
 const title=first.length>3&&first.length<=120?first:(fallback||"Crewbriefing")
 return {title,instructions:text}
}
export async function importBriefingLocally(file:File,locale:"nl"|"fr"|"en"|"de"):Promise<BriefingImportResult>{
 if(!file||file.size<1||file.size>MAX_FILE)throw Error("Briefing must be 20 MB or smaller")
 let text=""
 let images:File[]=[]
 if(officeTypes[file.type]){
  const result=await officeTextAndImages(file)
  text=result.text;images=result.images
 }else if(file.type==="text/plain"||file.type==="text/csv"){
  if(!/\.(txt|csv)$/i.test(file.name))throw Error("Invalid text extension")
  const bytes=new Uint8Array(await file.arrayBuffer())
  if(bytes.subarray(0,512).includes(0))throw Error("Invalid text file")
  text=validUtf8(bytes)
 }else if(["application/pdf","image/png","image/jpeg","image/webp"].includes(file.type)){
  // Cap decoded image memory on mobile for JPEG/PNG/WebP, not just upload bytes.
  const source=file.type==="application/pdf"?file:await imageAsBoundedPng(file)
  const result=await recognizeLocally(source,langs[locale],undefined,undefined,{maxBytes:MAX_FILE})
  text=result.text
 }else throw Error("Unsupported briefing document")
 const draft=briefingDraftFromText(text,file.name)
 if(!draft.instructions)throw Error("No readable briefing text found")
 return {...draft,images}
}
