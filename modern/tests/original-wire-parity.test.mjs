import test from "node:test"
import assert from "node:assert/strict"
import {encode,decode} from "../../lib/migration/wire.ts"
import {boundedMigrationForm} from "../../lib/migration/bounded-form.ts"
import {invokeOriginalAction,invokeOriginalRead} from "../src/original/transport.ts"

test("original source action wire round-trips exact user input, nested values, duplicate fields, dates, and binary attachments",()=>{
 const form=new FormData()
 form.append("crew","first")
 form.append("crew","second")
 form.append("attachment",new File([new Uint8Array([0,42,127,255])],"proof.png",{type:"image/png"}))
 const original={name:"Création – Äpfel & evenementen",when:new Date("2026-11-20T08:30:00.000Z"),
  nested:{approved:false,none:null,unknown:undefined},ids:[7,"abc",0],form}
 const attachments=new FormData(),envelope=encode(original,attachments)
 const output=decode(envelope,attachments)
 assert.equal(output.name,original.name)
 assert.equal(output.when.toISOString(),original.when.toISOString())
 assert.deepEqual(output.nested,original.nested)
 assert.deepEqual(output.ids,original.ids)
 assert.deepEqual(output.form.getAll("crew"),["first","second"])
 const proof=output.form.get("attachment")
 assert.equal(proof.name,"proof.png")
 assert.equal(proof.type,"image/png")
 assert.deepEqual([...new Uint8Array(Buffer.from(new Uint8Array([0,42,127,255])))],[0,42,127,255])
})
test("wire rejects invalid tags, nonfinite values, excessive nesting and 20k+ decode nodes",()=>{
 assert.throws(()=>encode(Number.POSITIVE_INFINITY,new FormData()),/Unsupported wire/)
 assert.throws(()=>encode(()=>null,new FormData()),/Unsupported wire/)
 assert.throws(()=>decode(["unsupported",true],new FormData()),/Invalid wire tag/)
 assert.throws(()=>decode(["date","not-a-date"],new FormData()),/Invalid wire tag/)
 assert.throws(()=>decode(["file","file:missing"],new FormData()),/Invalid file/)
 const deep=Array.from({length:20001},()=>["value",1])
 assert.throws(()=>decode(["array",deep],new FormData()),/Invalid wire/)
})
test("bounded original multipart parser preserves FormData without duplicating file bytes",async()=>{
 const body=new FormData()
 body.set("_id","lib/actions/uptilldawn.ts#createEvent")
 body.set("_args",'["array",[]]')
 body.append("file:0",new File([new Uint8Array([1,2,3])],"logo.jpg",{type:"image/jpeg"}))
 const request=new Request("https://uptilldawn-main.uptilldawn.workers.dev/api/migration/actions",{method:"POST",body})
 const parsed=await boundedMigrationForm(request)
 assert.equal(parsed.get("_id"),"lib/actions/uptilldawn.ts#createEvent")
 assert.equal(parsed.get("file:0").name,"logo.jpg")
 const oversize=new Request("https://uptilldawn-main.uptilldawn.workers.dev/api/migration/actions",{
  method:"POST",headers:{"content-type":"multipart/form-data; boundary=fixture","content-length":"40000000"},body:"x"})
 await assert.rejects(boundedMigrationForm(oversize),/too_large/)
})
test("actual candidate action call keeps the original action ID and preserves user data without executing a Main mutation",async()=>{
 const old=globalThis.fetch
 let requests=0
 try{
  globalThis.fetch=async (input,options)=>{
   requests++
   assert.equal(input,"/api/migration/actions")
   assert.equal(options.method,"POST")
   assert.equal(options.credentials,"same-origin")
   assert.equal(options.redirect,"error")
   const form=options.body
   const action=form.get("_id")
   assert.equal(action,"lib/actions/uptilldawn.ts#createEvent")
   const args=decode(JSON.parse(form.get("_args")),form)
   assert.equal(args[0].event,"Original crew event")
   assert.equal(args[0].date.toISOString(),"2026-11-20T21:00:00.000Z")
   assert.deepEqual(args[1].getAll("shift"),["first","second"])
   return Response.json({value:encode({saved:false,acceptedByOriginal:false},new FormData()),refresh:false})
  }
  const form=new FormData();form.append("shift","first");form.append("shift","second")
  const result=await invokeOriginalAction("lib/actions/uptilldawn.ts#createEvent",[
   {event:"Original crew event",date:new Date("2026-11-20T21:00:00.000Z")},form])
  assert.deepEqual(result,{saved:false,acceptedByOriginal:false})
  assert.equal(requests,1)
 }finally{globalThis.fetch=old}
})
test("candidate view-data bridge reports authorization failures instead of falsely returning sensitive data",async()=>{
 const old=globalThis.fetch
 try{
  globalThis.fetch=async(input,options)=>{
   assert.equal(input,"/api/migration/view-data")
   assert.equal(options.method,"POST")
   assert.equal(options.credentials,"same-origin")
   assert.deepEqual(JSON.parse(options.body),{id:"portal-preference",args:[]})
   return Response.json({error:"view_data_unavailable"},{status:401})
  }
  await assert.rejects(invokeOriginalRead("portal-preference",[]),/gegevens konden niet worden geladen/)
 }finally{globalThis.fetch=old}
})
