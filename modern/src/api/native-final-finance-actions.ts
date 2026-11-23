// Source-exact finance actions — draft documents, counterparties, invoice lines,
// settlement, reminder approvals, and signed storage attachments. The QA public
// worker retains writes=false until explicit acceptance of every action.
import {financialAmountCents,totalFinancialCents,reconcileFinanceInvoice} from "../../../lib/administration/finance-reconciliation.ts"
import {safeUploadName,validateUploadSecurity} from "../../../lib/upload-security.ts"
import type {NativeAdminActionDb} from "./native-admin-actions.ts"
import {parseMegaRequest,approvedAdmin,uuid,done,redirect,failure,type MegaDb,type AuthContext} from "./native-mega-helpers.ts"

const source="app/(app)/portals/administration/finance/page.tsx#"
export const finalFinanceActionIds=[
 source+"createCounterparty",source+"updateCounterparty",source+"createDraft",
 source+"addInvoiceLine",source+"updateInvoiceLine",source+"removeInvoiceLine",
 source+"updateDraftCounterparty",source+"updateDraftNotes",
 source+"updateDraftDocumentNumber",source+"updateInvoiceDates",
 source+"createPaymentReminder",source+"editPaymentReminderDraft",
 source+"updatePaymentReminder",source+"recordFinancialPayment",
 source+"updateFinancialStatus",source+"uploadFinancialAttachment"
] as const
export type FinalFinanceActionId=typeof finalFinanceActionIds[number]
const known=new Set<string>(finalFinanceActionIds)
export const finalFinanceActionAllowed=(id:string|null):id is FinalFinanceActionId=>
 typeof id==="string"&&known.has(id)
const str=(fd:FormData,key:string)=>String(fd.get(key)??"").trim()
const chk=(r:{error?:unknown})=>{if(r.error)throw Error("Finance database rejected operation")}
const one=(r:{data?:unknown,error?:unknown})=>{
 if(r.error||!Array.isArray(r.data)||r.data.length!==1)throw Error("Concurrent finance edit")
}
const decimal=/^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/
const email=/^[^\s@]+@[^\s@]+\.[^\s@]+$/
const isDate=(value:string)=>!value||/^\d{4}-\d{2}-\d{2}$/.test(value)&&
 Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value
const location="/portals/administration/finance"
async function access(db:MegaDb,a:AuthContext,adminOnly=false){
 if((!a.approved||a.account_blocked)&&!a.is_owner)throw Error("Account disabled")
 if(a.is_owner)return
 const isAdmin=await approvedAdmin(db,a)
 if(isAdmin)return
 if(adminOnly)throw Error("Admin required")
 const {data,error}=await db.rpc("upt_my_portal_assignments")
 if(error||!Array.isArray(data)||!data.some((r:any)=>r.portal==="administration"&&
  ["administrative_staff","admin"].includes(r.role)&&r.approved===true&&r.revoked_at===null))
  throw Error("Administration access required")
}
const save=()=>redirect(location)
const error=()=>redirect(location+"?error=1")
const conflict=()=>redirect(location+"?conflict=1")
async function settlement(db:MegaDb,id:string){
 const [d,p,c]=await Promise.all([
  db.from("admin_financial_documents").select("kind,status,gross_amount").eq("id",id).maybeSingle(),
  db.from("admin_financial_payments").select("amount",{count:"exact"}).eq("document_id",id).limit(1000),
  db.from("admin_financial_documents").select("gross_amount",{count:"exact"})
   .eq("kind","credit_note").eq("original_invoice_id",id)
   .in("status",["approved","issued","paid"]).limit(1000)
 ])
 if(d.error||!d.data||p.error||c.error||p.count===null||c.count===null||
  p.count>1000||c.count>1000||p.data?.length!==p.count||c.data?.length!==c.count)
  return null
 try{
  const grossCents=financialAmountCents(d.data.gross_amount)
  const paidCents=totalFinancialCents((p.data||[]).map((x:{amount:unknown})=>x.amount))
  const creditedCents=totalFinancialCents((c.data||[]).map((x:{gross_amount:unknown})=>x.gross_amount))
  return {...d.data,grossCents,paidCents,creditedCents,
   ...reconcileFinanceInvoice(grossCents,paidCents,creditedCents,d.data.status)}
 }catch{return null}
}
async function outstanding(db:MegaDb,id:string){
 const row=await settlement(db,id)
 if(!row||row.kind!=="sales_invoice"||row.grossCents<=0||row.overpaymentCents!==0)
  return null
 return row.outstandingCents/100
}
function todayBelgium(){
 return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Brussels",
  year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())
}
function datesWithTerms(issue:string,terms:number){
 if(!Number.isSafeInteger(terms)||terms<0||terms>365)throw Error("Invalid terms")
 const due=new Date(issue+"T12:00:00Z")
 due.setUTCDate(due.getUTCDate()+terms)
 return due.toISOString().slice(0,10)
}
function line(fd:FormData){
 const d=str(fd,"description"),raw=[str(fd,"quantity"),str(fd,"unit_price"),str(fd,"vat_rate")]
 if(!d||d.length>500||raw.some(x=>!decimal.test(x)))throw Error("Invalid invoice line")
 const [quantity,unit_price,vat_rate]=raw.map(Number)
 if(quantity<=0||quantity>100000||unit_price>999999999||vat_rate>100)
  throw Error("Invalid invoice line bounds")
 return {description:d,quantity,unit_price,vat_rate}
}
async function draft(db:MegaDb,doc:string,select="id,status"){
 const {data,error}=await db.from("admin_financial_documents").select(select)
  .eq("id",doc).maybeSingle()
 if(error||!data||data.status!=="draft")throw Error("Draft only")
 return data
}
async function party(db:MegaDb,id:string,kind:string){
 const {data,error}=await db.from("admin_counterparties").select("id,kind,payment_terms_days")
  .eq("id",id).maybeSingle()
 if(error||!data||kind==="sales_invoice"&&!["customer","both"].includes(data.kind)||
  kind==="purchase_invoice"&&!["supplier","both"].includes(data.kind))
  throw Error("Counterparty not permitted")
 return data
}
function counterpartyFields(fd:FormData){
 const name=str(fd,"name"),kind=str(fd,"kind"),emailValue=str(fd,"email")
 const street=str(fd,"street_address"),postal=str(fd,"postal_code"),city=str(fd,"city")
 const country=str(fd,"country_code").toUpperCase()
 const iban=str(fd,"iban").replace(/\s+/g,"").toUpperCase()
 const bic=str(fd,"bic").replace(/\s+/g,"").toUpperCase()
 const termValue=str(fd,"payment_terms_days")
 const terms=termValue===""?null:Number(termValue)
 const vat=str(fd,"vat_number"),enterprise=str(fd,"enterprise_number"),peppol=str(fd,"peppol_endpoint")
 if(!name||name.length>200||!["customer","supplier","both"].includes(kind)||
  emailValue.length>320||emailValue&&!email.test(emailValue)||
  street.length>300||postal.length>32||city.length>120||
  country&&!/^[A-Z]{2}$/.test(country)||
  iban&&!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)||
  bic&&!/^[A-Z0-9]{8}(?:[A-Z0-9]{3})?$/.test(bic)||
  terms!==null&&(!Number.isInteger(terms)||terms<0||terms>365)||
  vat.length>32||enterprise.length>32||peppol.length>200||
  /[\u0000-\u001f]/.test(peppol))throw Error("Invalid finance contact")
 return {
  name,kind,email:emailValue||null,street_address:street||null,
  postal_code:postal||null,city:city||null,country_code:country||null,
  iban:iban||null,bic:bic||null,payment_terms_days:terms,
  vat_number:vat||null,enterprise_number:enterprise||null,peppol_endpoint:peppol||null
 }
}
function revision(fd:FormData){
 const raw=str(fd,"expected_revision")
 if(!/^[1-9]\d{0,9}$/.test(raw)||Number(raw)>2147483647)throw Error("Invalid revision")
 return Number(raw)
}
async function remindable(db:MegaDb,id:string){
 const {data,error}=await db.from("admin_financial_documents")
  .select("kind,status,due_date,gross_amount").eq("id",id).maybeSingle()
 if(error||!data||data.kind!=="sales_invoice"||
  !["approved","issued"].includes(data.status)||
  !data.due_date||data.due_date>=todayBelgium())throw Error("Not overdue")
 const amount=await outstanding(db,id)
 if(amount===null||amount<=0.005)throw Error("No unpaid balance")
}
export async function finalFinanceResponse(
 req:Request,db:NativeAdminActionDb,selected:FinalFinanceActionId
):Promise<Response>{
 const name=selected.slice(source.length)
 const parsed=await parseMegaRequest(req,db,selected,0,name==="uploadFinancialAttachment"?22*1024*1024:64*1024)
 if(!parsed.ok)return parsed.response
 const {fd,actor,db:client}=parsed
 try{
  await access(client,actor)
  switch(name){
   case "createCounterparty":{
    chk(await client.from("admin_counterparties").insert(counterpartyFields(fd)))
    return save()
   }
   case "updateCounterparty":{
    const result=await client.from("admin_counterparties").update(counterpartyFields(fd))
     .eq("id",uuid(fd.get("counterparty_id"))).select("id")
    one(result);return save()
   }
   case "createDraft":{
    const kind=str(fd,"kind")
    if(!["sales_invoice","purchase_invoice","credit_note","expense","quote"].includes(kind))
     return done()
    const netRaw=str(fd,"net_amount"),taxRaw=str(fd,"tax_amount")
    const issue=str(fd,"issue_date"),dueRaw=str(fd,"due_date"),eventId=str(fd,"event_id")
    const partyId=str(fd,"counterparty_id"),original=str(fd,"original_invoice_id")
    if(!decimal.test(netRaw)||!decimal.test(taxRaw)||!isDate(issue)||!isDate(dueRaw)||
      dueRaw&&(!issue||dueRaw<issue))return error()
    let due=dueRaw
    if(eventId){
     const {data,error}=await client.from("events").select("id").eq("id",uuid(eventId)).maybeSingle()
     if(error||!data)return error()
    }
    if(partyId){
     const p=await party(client,uuid(partyId),kind)
     if(!due&&issue&&["sales_invoice","purchase_invoice"].includes(kind)&&
       Number.isInteger(p.payment_terms_days)&&p.payment_terms_days>=0&&p.payment_terms_days<=365)
      due=datesWithTerms(issue,p.payment_terms_days)
    }
    if(kind==="credit_note"){
     const {data,error}=await client.from("admin_financial_documents")
      .select("id,kind,status").eq("id",uuid(original)).maybeSingle()
     if(error||!data||!["sales_invoice","purchase_invoice"].includes(data.kind)||
       !["approved","issued","paid"].includes(data.status))return error()
    }
    chk(await client.from("admin_financial_documents").insert({
     kind,document_number:str(fd,"document_number").slice(0,100)||null,
     net_amount:Number(netRaw),tax_amount:Number(taxRaw),event_id:eventId?uuid(eventId):null,
     notes:str(fd,"notes").slice(0,2000)||null,status:"draft",currency:"EUR",
     counterparty_id:partyId?uuid(partyId):null,issue_date:issue||null,due_date:due||null,
     original_invoice_id:kind==="credit_note"?uuid(original):null
    }))
    return save()
   }
   case "addInvoiceLine":case "updateInvoiceLine":case "removeInvoiceLine":{
    const doc=uuid(fd.get("document_id"))
    await draft(client,doc)
    if(name==="addInvoiceLine"){
     chk(await client.from("admin_financial_lines").insert({document_id:doc,...line(fd)}))
    }else if(name==="updateInvoiceLine"){
     const result=await client.from("admin_financial_lines").update(line(fd))
      .eq("id",uuid(fd.get("line_id"))).eq("document_id",doc).select("id")
     one(result)
    }else{
     const result=await client.from("admin_financial_lines").delete()
      .eq("id",uuid(fd.get("line_id"))).eq("document_id",doc).select("id")
     one(result)
    }
    return save()
   }
   case "updateDraftNotes":
   case "updateDraftDocumentNumber":{
    const doc=uuid(fd.get("document_id"))
    const raw=name==="updateDraftNotes"?str(fd,"notes"):str(fd,"document_number")
    const key=name==="updateDraftNotes"?"notes":"document_number"
    if(raw.length>(key==="notes"?2000:100))return error()
    const result=await client.from("admin_financial_documents")
     .update({[key]:raw||null}).eq("id",doc).eq("status","draft").select("id")
    one(result);return save()
   }
   case "updateDraftCounterparty":{
    const doc=uuid(fd.get("document_id")),partyId=str(fd,"counterparty_id")
    const existing=await draft(client,doc,"kind,status,issue_date")
    const useTerms=fd.get("use_payment_terms")==="on"
    if(useTerms&&(!partyId||!existing.issue_date||
      !["sales_invoice","purchase_invoice"].includes(existing.kind)))return error()
    if(useTerms&&!isDate(existing.issue_date))return error()
    const p=partyId?await party(client,uuid(partyId),existing.kind):null
    const due=useTerms?datesWithTerms(existing.issue_date,p.payment_terms_days):undefined
    const result=await client.from("admin_financial_documents")
     .update({counterparty_id:partyId?uuid(partyId):null,...(useTerms?{due_date:due}:{} )})
     .eq("id",doc).eq("status","draft").select("id")
    one(result);return save()
   }
   case "updateInvoiceDates":{
    const doc=uuid(fd.get("document_id")),issue=str(fd,"issue_date")
    let due=str(fd,"due_date")
    if(!isDate(issue)||!isDate(due)||due&&(!issue||due<issue))return error()
    if(fd.get("use_payment_terms")==="on"){
     if(!issue)return error()
     const existing=await draft(client,doc,"kind,counterparty_id,status")
     if(!["sales_invoice","purchase_invoice"].includes(existing.kind)||
       !existing.counterparty_id)return error()
     const p=await party(client,uuid(existing.counterparty_id),existing.kind)
     due=datesWithTerms(issue,p.payment_terms_days)
    }
    const result=await client.from("admin_financial_documents")
     .update({issue_date:issue||null,due_date:due||null})
     .eq("id",doc).eq("status","draft").select("id")
    one(result);return save()
   }
   case "createPaymentReminder":{
    const doc=uuid(fd.get("document_id")),recipient=str(fd,"recipient_email")
    const subject=str(fd,"subject"),body=str(fd,"body")
    if(recipient.length<3||recipient.length>320||!recipient.includes("@")||
      !subject||subject.length>200||!body||body.length>10000)return error()
    await remindable(client,doc)
    const {data,error:lookupError}=await client.from("admin_payment_reminders")
     .select("reminder_number").eq("document_id",doc).order("reminder_number",{ascending:false}).limit(1)
    if(lookupError)return error()
    const next=Number(data?.[0]?.reminder_number??0)+1
    if(next>9)return error()
    chk(await client.from("admin_payment_reminders").insert({
     document_id:doc,reminder_number:next,recipient_email:recipient,
     subject,body,status:"draft"
    }))
    return save()
   }
   case "editPaymentReminderDraft":{
    const id=uuid(fd.get("reminder_id")),version=revision(fd)
    const recipient=str(fd,"recipient_email"),subject=str(fd,"subject"),body=str(fd,"body")
    if(recipient.length>320||!email.test(recipient)||!subject||subject.length>200||
      !body||body.length>10000)return error()
    const result=await client.from("admin_payment_reminders")
     .update({recipient_email:recipient,subject,body})
     .eq("id",id).eq("status","draft").eq("revision",version).select("id")
    if(result.error)return error()
    if(result.data?.length!==1)return conflict()
    return save()
   }
   case "updatePaymentReminder":{
    await access(client,actor,true)
    const id=uuid(fd.get("reminder_id")),version=revision(fd),status=str(fd,"status")
    if(!["approved","cancelled"].includes(status))return error()
    if(status==="approved"){
     const {data:r,error}=await client.from("admin_payment_reminders")
      .select("document_id").eq("id",id).eq("status","draft").maybeSingle()
     if(error)return error()
     if(!r)return conflict()
     await remindable(client,uuid(r.document_id))
    }
    const patch=status==="approved"?{
     status,approved_by:actor.id,approved_at:new Date().toISOString()
    }:{status}
    const result=await client.from("admin_payment_reminders").update(patch)
     .eq("id",id).eq("status","draft").eq("revision",version).select("id")
    if(result.error)return error()
    if(result.data?.length!==1)return conflict()
    return save()
   }
   case "recordFinancialPayment":{
    const doc=uuid(fd.get("document_id")),payment=uuid(fd.get("payment_id"))
    const amountRaw=str(fd,"amount"),paidOn=str(fd,"paid_on"),reference=str(fd,"bank_reference")
    if(!decimal.test(amountRaw)||!isDate(paidOn)||!paidOn||reference.length>200)return error()
    const amount=Number(amountRaw),cents=financialAmountCents(amount)
    if(amount<=0||amount>999999999||cents<=0)return error()
    const existingPayment=async()=>{
     const r=await client.from("admin_financial_payments")
      .select("document_id,amount,paid_on,bank_reference").eq("id",payment).maybeSingle()
     if(r.error)throw Error("Payment lookup failed")
     return r.data
    }
    const matches=(p:any)=>p?.document_id===doc&&Number(p.amount)===amount&&
      p.paid_on===paidOn&&p.bank_reference===(reference||null)
    const previous=await existingPayment()
    if(previous)return matches(previous)?save():error()
    const state=await settlement(client,doc)
    if(!state||!["approved","issued","paid"].includes(state.status)||
      cents>state.outstandingCents){
     const replay=await existingPayment()
     return matches(replay)?save():error()
    }
    const result=await client.from("admin_financial_payments").insert({
     id:payment,document_id:doc,amount,paid_on:paidOn,bank_reference:reference||null
    })
    if(result.error){
     const replay=await existingPayment()
     return matches(replay)?save():error()
    }
    return save()
   }
   case "updateFinancialStatus":{
    const id=uuid(fd.get("document_id")),status=str(fd,"status")
    if(!(["review"].includes(status)||["approved","issued","paid","void"].includes(status)&&
      (actor.is_owner||await approvedAdmin(client,actor))))return done()
    const {data:existing,error:e}=await client.from("admin_financial_documents")
     .select("status").eq("id",id).maybeSingle()
    if(e||!existing)return done()
    const transitions:Record<string,string[]>={draft:["review"],review:["approved"],
     approved:["issued","paid","void"],issued:["paid","void"]}
    if(!transitions[existing.status]?.includes(status))return done()
    if(status==="paid"){
     const s=await settlement(client,id)
     if(!s||s.grossCents<=0||s.outstandingCents!==0||s.overpaymentCents!==0)
      return error()
    }
    const patch:{status:string;approved_by?:string;approved_at?:string}={status}
    if(status==="approved"){patch.approved_by=actor.id;patch.approved_at=new Date().toISOString()}
    const result=await client.from("admin_financial_documents")
     .update(patch).eq("id",id).eq("status",existing.status).select("id")
    one(result);return save()
   }
   case "uploadFinancialAttachment":{
    const doc=uuid(fd.get("document_id")),file=fd.get("file")
    if(!(file instanceof File))return done()
    const {data:document,error:dError}=await client.from("admin_financial_documents")
     .select("id,status").eq("id",doc).maybeSingle()
    if(dError||!document||!["draft","review"].includes(document.status))
     return done()
    const validation=await validateUploadSecurity(file)
    if(!["application/pdf","image/jpeg","image/png","image/webp"].includes(validation.mime))
     return error()
    const bytes=new Uint8Array(await file.arrayBuffer())
    if(bytes.byteLength!==validation.size||!bytes.length||bytes.length>20*1024*1024)
     return error()
    const digest=await crypto.subtle.digest("SHA-256",bytes)
    const sha=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,"0")).join("")
    const {data:existing,error:checkError}=await client.from("admin_financial_attachments")
     .select("id").eq("document_id",doc).eq("sha256",sha).limit(1).maybeSingle()
    if(checkError)return error()
    if(existing)return redirect(location+"?duplicate=1")
    const path=actor.id+"/"+crypto.randomUUID()+"."+validation.extension
    const storage=client.storage.from("admin-financial-attachments")
    chk(await storage.upload(path,bytes,{contentType:validation.mime,upsert:false}))
    const link=await client.from("admin_financial_attachments").insert({
     document_id:doc,storage_path:path,original_name:safeUploadName(file.name),
     mime_type:validation.mime,size_bytes:validation.size,uploaded_by:actor.id,
     sha256:sha
    })
    if(link.error){
     await storage.remove([path])
     return redirect(location+((link.error as {code?:string}).code==="23505"?"?duplicate=1":"?error=1"))
    }
    return save()
   }
   default:return failure(404,"unknown_action")
  }
 }catch{return error()}
}
