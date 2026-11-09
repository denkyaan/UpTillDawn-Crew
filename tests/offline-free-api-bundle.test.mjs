import test from "node:test"
import assert from "node:assert/strict"
import {deflateRawSync} from "node:zlib"
import {readFileSync} from "node:fs"
import {briefingDraftFromText,importBriefingLocally} from "../lib/briefing-local-import.ts"

const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8")
const types={
 docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
 pptx:"application/vnd.openxmlformats-officedocument.presentationml.presentation",
 xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}
function makeZip(files){
 const local=[],central=[]
 let offset=0
 for(const [name,source] of files){
  const filename=Buffer.from(name)
  const uncompressed=Buffer.from(source)
  const compressed=deflateRawSync(uncompressed)
  const header=Buffer.alloc(30)
  header.writeUInt32LE(0x04034b50,0)
  header.writeUInt16LE(20,4)
  header.writeUInt16LE(8,8)
  header.writeUInt32LE(compressed.length,18)
  header.writeUInt32LE(uncompressed.length,22)
  header.writeUInt16LE(filename.length,26)
  local.push(header,filename,compressed)
  const entry=Buffer.alloc(46)
  entry.writeUInt32LE(0x02014b50,0)
  entry.writeUInt16LE(20,4)
  entry.writeUInt16LE(20,6)
  entry.writeUInt16LE(8,10)
  entry.writeUInt32LE(compressed.length,20)
  entry.writeUInt32LE(uncompressed.length,24)
  entry.writeUInt16LE(filename.length,28)
  entry.writeUInt32LE(offset,42)
  central.push(entry,filename)
  offset+=header.length+filename.length+compressed.length
 }
 const directory=Buffer.concat(central)
 const end=Buffer.alloc(22)
 end.writeUInt32LE(0x06054b50,0)
 end.writeUInt16LE(files.length,8)
 end.writeUInt16LE(files.length,10)
 end.writeUInt32LE(directory.length,12)
 end.writeUInt32LE(offset,16)
 return Buffer.concat([...local,directory,end])
}
const office=(name,mime,parts)=>new File([makeZip(parts)],name,{type:mime})

test("office DOCX text + embedded image are extracted on the device without server APIs",async()=>{
 const file=office("crew.docx",types.docx,[
  ["word/document.xml",'<w:document><w:p><w:t>Crewbriefing</w:t></w:p><w:p><w:t>Event: Up &amp; Down</w:t></w:p></w:document>'],
  ["word/media/logo.png",Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0])],
 ])
 const result=await importBriefingLocally(file,"nl")
 assert.equal(result.title,"Crewbriefing")
 assert.match(result.instructions,/Event: Up & Down/)
 assert.equal(result.images.length,1)
 assert.equal(result.images[0].type,"image/png")
})

test("PPTX slide text and XLSX shared strings remain readable without an API key",async()=>{
 const pptx=office("slides.pptx",types.pptx,[
  ["ppt/slides/slide1.xml",'<p:sld><a:p><a:t>Briefing for volunteers</a:t></a:p><a:p><a:t>Doors open 19:00</a:t></a:p></p:sld>']
 ])
 const slides=await importBriefingLocally(pptx,"en")
 assert.match(slides.instructions,/Doors open 19:00/)
 const xlsx=office("roster.xlsx",types.xlsx,[
  ["xl/sharedStrings.xml",'<sst><si><t>Volunteers</t></si><si><t>Entrance</t></si></sst>'],
  ["xl/worksheets/sheet1.xml",'<worksheet><sheetData><row><c t="s"><v>0</v></c><c t="s"><v>1</v></c><c><v>20</v></c></row></sheetData></worksheet>']
 ])
 const sheets=await importBriefingLocally(xlsx,"en")
 assert.match(sheets.instructions,/Volunteers \| Entrance \| 20/)
})

test("document import rejects incorrect Office signatures and keeps source text intact",async()=>{
 await assert.rejects(importBriefingLocally(new File(["not a zip"],"x.docx",{type:types.docx}),"nl"),/Invalid Office signature/)
 await assert.rejects(importBriefingLocally(new File(["hello"],"unsafe.exe",{type:"text/plain"}),"nl"),/Invalid text extension/)
 const result=briefingDraftFromText("  Inkom briefing\r\nVerplicht check-in\nBel verantwoordelijke","x.txt")
 assert.equal(result.title,"Inkom briefing")
 assert.match(result.instructions,/Verplicht check-in/)
 assert.match(result.instructions,/Bel verantwoordelijke/)
})

test("briefing import is browser-local and legacy paid fallback is explicitly disabled by default",()=>{
 const client=read("components/crew/briefing-analysis-fields.tsx")
 const engine=read("lib/briefing-local-import.ts")
 const legacy=read("app/api/briefing-analyze/route.ts")
 assert.match(client,/importBriefingLocally\(file,locale\)/)
 assert.doesNotMatch(client,/fetch\(['"]\/api\/briefing-(?:analyze|extract-media)/)
 assert.doesNotMatch(engine,/fetch\(|api\.openai\.com|api\.cloudmersive\.com/)
 assert.match(legacy,/UPT_ENABLE_EXTERNAL_BRIEFING_AI!=="true"/)
 assert.match(client,/<OfflineOcrPrepButton locale=\{locale\}\/>/)
})

test("offline OCR prefetch is same-origin and shares the service worker cache",()=>{
 const cache=read("lib/offline-ocr-precache.ts")
 const worker=read("public/sw.js")
 const invoice=read("components/administration/local-document-ocr-preview.tsx")
 assert.match(cache,/uptilldawn-ocr-v1/)
 assert.match(cache,/\/vendor\/ocr\//)
 assert.match(cache,/new File|cache\.put\(url,response\)/)
 assert.match(worker,/LOCAL_OCR_CACHE='uptilldawn-ocr-v1'/)
 assert.match(invoice,/<OfflineOcrPrepButton locale=\{locale\}\/>/)
 assert.doesNotMatch(cache,/cdn\.|https?:\/\//)
})

test("address search is opt-in and coordinates can be entered without a provider",()=>{
 const fields=read("components/events/geoapify-place-fields.tsx")
 assert.match(fields,/useState\(false\)/)
 assert.match(fields,/!onlineLookup\|\|!focused/)
 assert.match(fields,/checked=\{onlineLookup\}/)
 for(const coordinate of ["latitude","longitude"])assert.match(fields,new RegExp('name="'+coordinate+'"'))
})

test("malware quarantine, external payment delivery and production boundaries are not bypassed",()=>{
 const scan=read("supabase/functions/malware-scan/index.ts")
 const deploy=read(".github/workflows/deploy-main.yml")
 assert.match(scan,/scanner_unconfigured/)
 assert.match(scan,/scanner_indeterminate/)
 assert.match(scan,/CleanResult/)
 assert.match(deploy,/wrangler deploy --config wrangler\.main\.jsonc/)
 assert.doesNotMatch(deploy,/wrangler deploy --config wrangler\.jsonc/)
})
