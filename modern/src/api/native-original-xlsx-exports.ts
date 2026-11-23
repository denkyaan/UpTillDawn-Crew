// Native extraction of the ORIGINAL /api/uptilldawn/{export,sales-export}
// browser endpoints. The source's signed admin RPCs, workbook columns, sheets,
// calculation and audit are preserved. All reads remain user/RLS scoped.
import type {SupabaseClient} from "@supabase/supabase-js"
import {allocateTime,type TimeSession,type TimeBreak,type Transition} from "../../../lib/crew-time.ts"
import {buildXlsx,type Cell,type Sheet} from "./worker-xlsx.ts"

type Row=Record<string,unknown>
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
const fail=(message:string,status:number)=>new Response(message,{status,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}})
const str=(value:unknown)=>value===undefined||value===null?"":String(value)
const num=(value:unknown)=>typeof value==="number"?value:Number(value)
const money=(cents:unknown)=>Math.round(num(cents))/100
const date=(value:unknown)=>new Date(str(value))
const get=(row:Row,key:string)=>row[key]
const MAX_SOURCE_ROWS=36000
const MAX_TABLE_ROWS=15000

async function authorizedAdmin(db:SupabaseClient,userId:string):Promise<boolean>{
 const [approved,admin]=await Promise.all([
  db.rpc("upt_is_approved"),db.rpc("upt_is_admin",{uid:userId})
 ])
 return !approved.error&&!admin.error&&approved.data===true&&admin.data===true
}

// Supabase's default 1000-row cap can silently truncate an export; retrieve
// all visible pages, never return an incomplete document and cap Worker memory.
async function pages(db:SupabaseClient,table:string,columns:string,order:string,tracker:{total:number},eventId?:string){
 const output:Row[]=[]
 for(let offset=0;;offset+=500){
  let query=db.from(table).select(columns)
  if(eventId)query=query.eq("event_id",eventId)
  const {data,error}=await query.order(order).range(offset,offset+499)
  if(error)throw Error("data_unavailable")
  const rows=(data??[]) as Row[]
  tracker.total+=rows.length
  if(output.length+rows.length>MAX_TABLE_ROWS||tracker.total>MAX_SOURCE_ROWS)throw Error("source_too_large")
  output.push(...rows)
  if(rows.length<500)return output
 }
}
function download(sheets:Sheet[],name:string){
 try{
  const bytes=buildXlsx(sheets)
  return new Response(bytes.buffer as ArrayBuffer,{headers:{
   "Content-Type":mime,
   "Content-Disposition":'attachment; filename="'+name+'"',
   "Cache-Control":"private, no-store",
   "X-Content-Type-Options":"nosniff"
  }})
 }catch{return fail("Export is te groot of bevat ongeldige waarden.",413)}
}

export async function nativeSalesXlsx(db:SupabaseClient,request:Request,userId:string):Promise<Response>{
 if(!await authorizedAdmin(db,userId))return fail("Geen toegang.",403)
 const eventId=new URL(request.url).searchParams.get("event")
 if(!eventId||!uuid.test(eventId))return fail("Ongeldig evenement.",400)
 const tracker={total:0}
 let event:Row,tx:Row[],registers:Row[],workplaces:Row[],people:Row[]
 try{
  const results=await Promise.all([
   db.from("events").select("id,name,start_at,end_at").eq("id",eventId).single(),
   pages(db,"sales_transactions","*","created_at",tracker,eventId),
   pages(db,"sales_registers","*","id",tracker,eventId),
   pages(db,"workplaces","id,name","id",tracker,eventId),
   db.rpc("upt_admin_personnel_details_v2")
  ])
  const [evt,transactions,cash,posts,personResult]=results
  if(evt.error||!evt.data||personResult.error||!Array.isArray(personResult.data))throw Error("data_unavailable")
  if(personResult.data.length>MAX_TABLE_ROWS)throw Error("source_too_large")
  event=evt.data as Row;tx=transactions;registers=cash;workplaces=posts;people=personResult.data as Row[]
 }catch{return fail("Salesexport kon niet volledig worden geladen.",503)}
 const names=new Map(workplaces.map(row=>[str(row.id),str(row.name)]))
 const staff=new Map(people.map(row=>[str(row.id),str(row.full_name||row.email||"Personeelslid")]))
 const sign=(row:Row)=>row.transaction_type==="refund"?-1:1
 const net=(filter:(row:Row)=>boolean)=>tx.filter(filter).reduce((total,row)=>total+sign(row)*num(row.total_cents),0)
 const headers=["Datum/tijd","Evenement","Werkplek/kassa","Item","Categorie","Type","Aantal",
  "Prijs/stuk","Totaal","Betaalmethode","Medewerker","Notitie"]
 const rows:Cell[][]=[headers]
 for(const row of tx){
  const time=date(row.created_at)
  if(!Number.isFinite(time.getTime()))return fail("Salesexport bevat ongeldige datums.",409)
  rows.push([
   time,str(event.name),names.get(str(row.workplace_id))||"Werkplek",str(row.product_name),
   row.sale_category==="merch"?"Merch":"Token",row.transaction_type==="refund"?"Refund":"Verkoop",
   sign(row)*num(row.quantity),{value:money(row.unit_price_cents),style:1},
   {value:sign(row)*money(row.total_cents),style:1},
   row.payment_method==="cash"?"Cash":"Kaart",
   row.seller_id?staff.get(str(row.seller_id))||"Personeelslid":"—",
   str(row.notes)
  ])
 }
 const summary:Cell[][]=[
  ["Evenement",str(event.name)],["Start",date(event.start_at)],["Einde",date(event.end_at)],[],
  ["Netto omzet",{value:money(net(()=>true)),style:1}],
  ["Cash",{value:money(net(row=>row.payment_method==="cash")),style:1}],
  ["Kaart",{value:money(net(row=>row.payment_method==="card")),style:1}],
  ["Merch",{value:money(net(row=>row.sale_category==="merch")),style:1}],
  ["Tokens",{value:money(net(row=>row.sale_category==="token")),style:1}],
  [],["Kassa/werkplek","Begininhoud cash","Netto cashverkopen","Verwachte cash"]
 ]
 for(const register of registers){
  const cash=net(row=>row.workplace_id===register.workplace_id&&row.payment_method==="cash")
  summary.push([names.get(str(register.workplace_id))||"Kassa",
   {value:money(register.opening_cash_cents),style:1},
   {value:money(cash),style:1},
   {value:money(num(register.opening_cash_cents)+cash),style:1}])
 }
 return download([
  {name:"Transacties",rows,widths:[22,28,24,28,14,14,10,14,14,16,24,36],
   boldRows:[1],freezeHeader:true,autoFilter:"A1:L1"},
  {name:"Samenvatting",rows:summary,widths:[28,28,20,20],boldRows:[11]}
 ],"uptilldawn-sales-"+eventId+".xlsx")
}

const exportTables=[
 ["work_sessions","*","started_at"],
 ["break_sessions","*","id"],
 ["workplace_transitions","*","id"],
 ["events","*","id"],
 ["profiles","id,full_name","id"],
 ["shifts","*","id"],
 ["workplaces","id,name","id"],
 ["responsible_assignments","*","id"],
 ["check_ins","user_id,event_id,status","id"],
 ["briefings","*","id"],
 ["briefing_acknowledgements","*","id"],
 ["tasks","*","id"],
 ["task_assignments","*","id"]
] as const

export async function nativeWorkSessionsXlsx(db:SupabaseClient,userId:string):Promise<Response>{
 if(!await authorizedAdmin(db,userId))return fail("Geen toegang.",403)
 const tracker={total:0},tables=new Map<string,Row[]>()
 try{
  // Three source reads concurrently: avoid launching 13 full-table
  // pagination chains at once on Cloudflare Free/Supabase shared resources.
  for(let i=0;i<exportTables.length;i+=3){
   const batch=exportTables.slice(i,i+3)
   const loaded=await Promise.all(batch.map(row=>pages(db,row[0],row[1],row[2],tracker)))
   batch.forEach((row,j)=>tables.set(row[0],loaded[j]))
  }
 }catch{return fail("Exportgegevens konden niet volledig worden geladen.",503)}
 const rows=(key:string)=>tables.get(key)??[]
 const sessions=rows("work_sessions"),breaks=rows("break_sessions"),transitions=rows("workplace_transitions")
 const events=rows("events"),people=rows("profiles"),shifts=rows("shifts"),workplaces=rows("workplaces")
 const leads=rows("responsible_assignments"),checkins=rows("check_ins"),briefings=rows("briefings")
 const acks=rows("briefing_acknowledgements"),tasks=rows("tasks"),assignments=rows("task_assignments")
 let allocated:ReturnType<typeof allocateTime>
 try{
  allocated=allocateTime(sessions.map(s=>({...s,workplace_id:shifts.find(shift=>shift.id===s.shift_id)?.workplace_id||null}) as TimeSession),
   breaks as TimeBreak[],transitions as Transition[],Date.now())
  if(allocated.length>15999)throw Error("workbook_too_large")
 }catch{return fail("Tijdregistraties vereisen correctie voor export.",409)}
 const eventById=new Map(events.map(x=>[str(x.id),x]))
 const personById=new Map(people.map(x=>[str(x.id),str(x.full_name)]))
 const workplaceById=new Map(workplaces.map(x=>[str(x.id),str(x.name)]))
 const headers=["Datum","Evenement","Medewerker","Werkplek","Rol","Verantwoordelijke",
  "Dienst start","Dienst einde","Brutoduur","Betaalde pauze","Onbetaalde pauze",
  "Netto-uren","Overwerk","Instructies bevestigd","Taken bevestigd","Inklokstatus"]
 const matrix:Cell[][]=[headers]
 try{
  for(const row of allocated){
   const event=eventById.get(row.eventId),zone=str(event?.timezone)||"Europe/Brussels"
   const shift=shifts.find(x=>x.user_id===row.userId&&x.event_id===row.eventId&&x.workplace_id===row.workplaceId&&
     Date.parse(str(x.scheduled_start))<=row.start&&Date.parse(str(x.scheduled_end))>row.start)
   const format=(timestamp:number)=>new Intl.DateTimeFormat("nl-BE",{timeZone:zone,
    dateStyle:"short",timeStyle:"short"}).format(timestamp)
   const required=briefings.filter(b=>b.event_id===row.eventId&&b.required&&
    (!b.workplace_id||b.workplace_id===row.workplaceId))
   const own=assignments.filter(a=>a.user_id===row.userId&&tasks.some(t=>t.id===a.task_id&&
    t.event_id===row.eventId&&(!t.workplace_id||t.workplace_id===row.workplaceId)))
   const responsible=leads.filter(l=>l.workplace_id===row.workplaceId)
    .map(l=>personById.get(str(l.user_id))||str(l.user_id)).join(", ")
   matrix.push([
    format(row.start),str(event?.name),
    personById.get(row.userId)||"",workplaceById.get(str(row.workplaceId))||"",
    str(shift?.role_name),responsible,
    shift?format(Date.parse(str(shift.scheduled_start))):"",
    shift?format(Date.parse(str(shift.scheduled_end))):"",
    row.grossSeconds/3600,row.regularBreakSeconds/3600,row.excessBreakSeconds/3600,
    row.netSeconds/3600,"Niet vastgesteld",
    required.every(b=>acks.some(a=>a.briefing_id===b.id&&a.user_id===row.userId&&a.version===b.version))?"Ja":"Nee",
    own.length?(own.every(a=>a.status==="COMPLETED")?"Ja":"Nee"):"N.v.t.",
    checkins.some(c=>c.user_id===row.userId&&c.event_id===row.eventId&&c.status==="approved")?"Goedgekeurd":"Niet goedgekeurd"
   ])
  }
 }catch{return fail("Tijdregistraties vereisen correctie voor export.",409)}
 const notes:Cell[][]=[
  ["Tijden zijn per werkpleksegment; totalen worden niet nogmaals als datarij toegevoegd."],
  ["Numerieke duurkolommen zijn decimale uren. Eerste 60 minuten pauze per medewerker/event zijn betaald."],
  ["Overwerk is niet berekend: een goedgekeurde overwerkdefinitie ontbreekt."],
  ["Actieve sessies zijn een momentopname; controleer registraties voor loonverwerking."]
 ]
 let bytes:Uint8Array
 try{bytes=buildXlsx([
  {name:"Werkpleksegmenten",rows:matrix,widths:Array(16).fill(24),boldRows:[1],
   freezeHeader:true,autoFilter:"A1:P1"},
  {name:"Toelichting",rows:notes,widths:[80]}
 ])}catch{return fail("Export is te groot of bevat ongeldige waarden.",413)}
 // Source audit is mandatory: never expose downloaded timesheets when the
 // original audit RPC could not attest that an admin exported the records.
 try{
  const {error}=await db.rpc("upt_audit_export")
  if(error)return fail("Export kon niet worden geaudit.",503)
 }catch{return fail("Export kon niet worden geaudit.",503)}
 return new Response(bytes.buffer as ArrayBuffer,{headers:{
  "Content-Type":mime,"Content-Disposition":'attachment; filename="uptilldawn-uren.xlsx"',
  "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"
 }})
}
