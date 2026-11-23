import test from "node:test"
import assert from "node:assert/strict"
import {buildXlsx} from "../src/api/worker-xlsx.ts"
import {nativeSalesXlsx,nativeWorkSessionsXlsx} from "../src/api/native-original-xlsx-exports.ts"
import app from "../src/api/worker.ts"

const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const eventId="11111111-1111-4111-8111-111111111111"
const now="2026-11-20T20:00:00.000Z"

// Validate the ZIP local file records without installing a ZIP/XLSX package.
// If either CRC or a worksheet name regresses, Office cannot read the export.
function parts(bytes){
 const data=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength)
 let offset=0,entries=new Map()
 while(offset+30<bytes.length&&data.getUint32(offset,true)===0x04034b50){
  const crc=data.getUint32(offset+14,true),length=data.getUint32(offset+18,true)
  const nameLength=data.getUint16(offset+26,true),extra=data.getUint16(offset+28,true)
  const name=new TextDecoder().decode(bytes.subarray(offset+30,offset+30+nameLength))
  const start=offset+30+nameLength+extra
  assert.equal(data.getUint16(offset+8,true),0,"ZIP must contain stored bytes")
  const content=bytes.subarray(start,start+length)
  assert.equal(content.length,length)
  entries.set(name,{content:new TextDecoder().decode(content),crc})
  offset=start+length
 }
 assert.equal(data.getUint32(offset,true),0x02014b50,"ZIP central directory exists")
 return entries
}
function fakeDb(overrides={}){
 const calls=[]
 const tables=overrides.tables??{}
 const result=(table)=>tables[table]??[]
 return {
  calls,
  rpc:async(name)=>{calls.push(name);if(name==="upt_audit_export"&&overrides.auditError)return {error:{code:"42501"}}
   if(name==="upt_admin_personnel_details_v2")return {data:[{id:eventId,full_name:"Team"}],error:null}
   if(name==="upt_is_approved"||name==="upt_is_admin")return {data:!overrides.denied,error:null}
   return {data:null,error:null}},
  from:(table)=>{calls.push("from:"+table)
   const query={eq:()=>query,order:()=>query,range:async()=>({data:result(table),error:null}),
    single:async()=>({data:result(table)[0]??null,error:null})}
   return {select:()=>query}
  }
 }
}
test("Worker ZIP writer produces a valid two-sheet XLSX structure, numeric currency, and neutralizes formula text",()=>{
 const bytes=buildXlsx([
  {name:"Transacties",rows:[["Naam","Bedrag","Wanneer"],["=1+1",{value:12.5,style:1},new Date(now)]],
   widths:[24,16,22],boldRows:[1],freezeHeader:true,autoFilter:"A1:C1"},
  {name:"Samenvatting",rows:[["Totaal",12.5]]}
 ])
 assert.equal(bytes[0],0x50);assert.equal(bytes[1],0x4b)
 const entries=parts(bytes)
 for(const path of ["[Content_Types].xml","_rels/.rels","xl/workbook.xml",
  "xl/_rels/workbook.xml.rels","xl/styles.xml",
  "xl/worksheets/sheet1.xml","xl/worksheets/sheet2.xml"])
  assert.ok(entries.has(path),path)
 const sheet=entries.get("xl/worksheets/sheet1.xml").content
 assert.match(sheet,/<t xml:space="preserve">'=1\+1<\/t>/)
 assert.doesNotMatch(sheet,/<f(?:\s|>)/)
 assert.match(sheet,/<c r="B2" s="1"><v>12.5<\/v><\/c>/)
 assert.match(sheet,/autoFilter ref="A1:C1"/)
 assert.match(sheet,/pane ySplit="1"/)
 assert.match(entries.get("xl/workbook.xml").content,/Transacties/)
})
test("Worker XLSX rejects non-finite numerical data, invalid sheet names and abusive row counts",()=>{
 assert.throws(()=>buildXlsx([{name:"Invalid/Name",rows:[["x"]]}]),/invalid_worksheet/)
 assert.throws(()=>buildXlsx([{name:"Valid",rows:[[Infinity]]}]),/invalid_workbook_number/)
 assert.throws(()=>buildXlsx([{name:"Valid",rows:Array.from({length:16001},()=>[1])}]),/workbook_too_large/)
})
test("native sales returns the original two XLSX sheets with refunds, cash, and safely escaped notes",async()=>{
 const db=fakeDb({tables:{
  events:[{id:eventId,name:"Event & Crew",start_at:now,end_at:now}],
  sales_transactions:[
   {id:"a",created_at:now,workplace_id:"post",product_name:"=bad",sale_category:"merch",
    transaction_type:"sale",quantity:2,unit_price_cents:500,total_cents:1000,
    payment_method:"cash",seller_id:eventId,notes:"<test>"},
   {id:"b",created_at:now,workplace_id:"post",product_name:"Cap",sale_category:"token",
    transaction_type:"refund",quantity:1,unit_price_cents:200,total_cents:200,
    payment_method:"card",notes:""}
  ],sales_registers:[{id:"a",workplace_id:"post",opening_cash_cents:500}],
  workplaces:[{id:"post",name:"Bar"}]
 }})
 const res=await nativeSalesXlsx(db,new Request(origin+"/api/uptilldawn/sales-export?event="+eventId),eventId)
 assert.equal(res.status,200)
 assert.match(res.headers.get("content-type"),/spreadsheetml/)
 assert.match(res.headers.get("content-disposition"),/uptilldawn-sales-/)
 const entries=parts(new Uint8Array(await res.arrayBuffer()))
 const tx=entries.get("xl/worksheets/sheet1.xml").content
 const sums=entries.get("xl/worksheets/sheet2.xml").content
 assert.match(tx,/<t xml:space="preserve">'=bad<\/t>/)
 assert.match(tx,/&lt;test&gt;/)
 assert.match(tx,/<v>-2<\/v>/)
 assert.match(sums,/Samenvatting|Netto omzet/)
 assert.match(sums,/<v>8<\/v>/)
 assert.ok(db.calls.includes("upt_is_admin"))
})
test("sales rejects unauthenticated admin grants and malformed event ids before table reads",async()=>{
 const denied=fakeDb({denied:true})
 const res=await nativeSalesXlsx(denied,new Request(origin+"/api/uptilldawn/sales-export?event="+eventId),eventId)
 assert.equal(res.status,403)
 assert.ok(!denied.calls.some(x=>x.startsWith("from:")))
 const bad=fakeDb()
 assert.equal((await nativeSalesXlsx(bad,new Request(origin+"/api/uptilldawn/sales-export?event=no"),eventId)).status,400)
 assert.ok(!bad.calls.some(x=>x.startsWith("from:")))
})
test("native hours workbook preserves explanatory sheet and performs the mandatory audit",async()=>{
 const db=fakeDb()
 const res=await nativeWorkSessionsXlsx(db,eventId)
 assert.equal(res.status,200)
 assert.equal(db.calls.at(-1),"upt_audit_export")
 const entries=parts(new Uint8Array(await res.arrayBuffer()))
 assert.match(entries.get("xl/worksheets/sheet1.xml").content,/Werkplek/)
 assert.match(entries.get("xl/worksheets/sheet2.xml").content,/Overwerk is niet berekend/)
 assert.equal(db.calls.filter(x=>x.startsWith("from:")).length,13)
})
test("hours export never sends an un-audited workbook",async()=>{
 const db=fakeDb({auditError:true})
 const res=await nativeWorkSessionsXlsx(db,eventId)
 assert.equal(res.status,503)
 assert.equal(await res.text(),"Export kon niet worden geaudit.")
})
test("original XLSX routes are registered and require signed SSR cookie context",async()=>{
 const env={SUPABASE_URL:"https://npbjrtiolqperdgljnhi.supabase.co",SUPABASE_ANON_KEY:"sb_publishable_test"}
 const sales=await app.request(origin+"/api/uptilldawn/sales-export?event="+eventId,{method:"GET"},env)
 const hours=await app.request(origin+"/api/uptilldawn/export",{method:"GET"},env)
 assert.equal(sales.status,401)
 assert.equal(hours.status,401)
})
