import {NextResponse} from 'next/server'
import {getCurrentUser} from '@/lib/actions/auth'
import {createClient} from '@/lib/supabase/crew-server'
import {canOpenPortal,type PortalAssignment} from '@/lib/portal-access'
import {financeCsv,financialAging} from '@/lib/administration/finance-report'
import {reconcileFinanceInvoice} from '@/lib/administration/finance-reconciliation'

export const dynamic='force-dynamic'
export async function GET(){
 const current=await getCurrentUser()
 if(!current)return NextResponse.json({error:'Unauthorized'},{status:401})
 const db=await createClient()
 if((!current.approved||current.account_blocked===true)&&!current.isOwner)return NextResponse.json({error:'Forbidden'},{status:403})
 if(!current.isOwner&&!current.realIsAdmin){
  const {data,error}=await db.rpc('upt_my_portal_assignments')
  if(error||!canOpenPortal('administration',(data??[]) as PortalAssignment[],{approved:current.approved,blocked:current.account_blocked===true}))
   return NextResponse.json({error:'Forbidden'},{status:403})
 }
 const documents: {id:string;kind:string;document_number:string|null;status:string;currency:string;gross_amount:number|null;due_date:string|null;issue_date:string|null;original_invoice_id:string|null}[]=[]
 const payments: {id:string;document_id:string;amount:number}[]=[]
 const seenDocumentIds=new Set<string>()
 const seenPaymentIds=new Set<string>()
 let previousDocumentId=''
 let previousPaymentId=''
 let documentTotal:number|null=null
 let paymentTotal:number|null=null
 for(let offset=0;offset<10000;offset+=500){
  const {data,error,count}=await db.from('admin_financial_documents').select('id,kind,document_number,status,currency,gross_amount,due_date,issue_date,original_invoice_id',{count:'exact'}).order('id').range(offset,offset+499)
  if(error)return NextResponse.json({error:'Financial documents unavailable'},{status:503})
  if(count===null||!Number.isSafeInteger(count))return NextResponse.json({error:'Document count unavailable'},{status:503})
  if(documentTotal!==null&&documentTotal!==count)return NextResponse.json({error:'Document count changed during export'},{status:409})
  documentTotal=count
  for(const doc of data??[]){
   if(!doc.id||seenDocumentIds.has(doc.id)||doc.id<=previousDocumentId)return NextResponse.json({error:'Document pagination changed during export'},{status:409})
   seenDocumentIds.add(doc.id)
   previousDocumentId=doc.id
   documents.push(doc)
  }
  if((data??[]).length<500)break
 }
 if(documentTotal!==null&&documentTotal>10000)return NextResponse.json({error:'Export exceeds 10000 documents; narrow the dataset before exporting'},{status:413})
 if(documentTotal===null||documents.length!==documentTotal)return NextResponse.json({error:'Incomplete document export'},{status:503})
 const typed=db as unknown as {from:(name:string)=>{select:(columns:string,options?:{count:'exact'})=>{order:(column:string,options?:{ascending:boolean})=>{order:(column:string,options?:{ascending:boolean})=>{range:(from:number,to:number)=>Promise<{data:{id:string;document_id:string;amount:number}[]|null;error:unknown;count:number|null}>}}}}}
 for(let offset=0;offset<50000;offset+=500){
  const {data,error,count}=await typed.from('admin_financial_payments').select('id,document_id,amount',{count:'exact'}).order('document_id').order('id').range(offset,offset+499)
  if(error)return NextResponse.json({error:'Payments unavailable'},{status:503})
  if(count===null||!Number.isSafeInteger(count))return NextResponse.json({error:'Payment count unavailable'},{status:503})
  if(paymentTotal!==null&&paymentTotal!==count)return NextResponse.json({error:'Payment count changed during export'},{status:409})
  paymentTotal=count
  for(const payment of data??[]){
   const key=payment.document_id+'|'+payment.id
   if(!payment.id||!payment.document_id||seenPaymentIds.has(payment.id)||key<=previousPaymentId)return NextResponse.json({error:'Payment pagination changed during export'},{status:409})
   seenPaymentIds.add(payment.id)
   previousPaymentId=key
   payments.push(payment)
  }
  if((data??[]).length<500)break
 }
 if(paymentTotal!==null&&paymentTotal>50000)return NextResponse.json({error:'Export exceeds 50000 payments; narrow the dataset before exporting'},{status:413})
 if(paymentTotal===null||payments.length!==paymentTotal)return NextResponse.json({error:'Incomplete payment export'},{status:503})
 const byDocument=new Map<string,number>()
 for(const payment of payments){
  if(payment.amount===null||!Number.isFinite(Number(payment.amount))||Number(payment.amount)<0||!Number.isSafeInteger(Math.round(Number(payment.amount)*100)))
   return NextResponse.json({error:'Invalid payment amount in export'},{status:422})
  byDocument.set(payment.document_id,(byDocument.get(payment.document_id)??0)+Math.round(Number(payment.amount)*100))
 }
 const creditsByInvoice=new Map<string,number>()
 for(const doc of documents){
  if(doc.kind!=='credit_note'||!doc.original_invoice_id||!['approved','issued','paid'].includes(doc.status))continue
  const amount=Number(doc.gross_amount)
  if(!Number.isFinite(amount)||amount<0||!Number.isSafeInteger(Math.round(amount*100)))return NextResponse.json({error:'Invalid credit note amount'},{status:422})
  creditsByInvoice.set(doc.original_invoice_id,(creditsByInvoice.get(doc.original_invoice_id)??0)+Math.round(amount*100))
 }
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Brussels',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
 const rows:unknown[][]=[['Document ID','Number','Type','Status','Issue date','Due date','Currency','Gross amount','Paid amount','Approved credit notes','Outstanding after credits','Overpayment after credits','Aging','Reconciliation issues']]
 for(const doc of documents){
  const gross=Number(doc.gross_amount)
  const paid=(byDocument.get(doc.id)??0)/100
  const credits=doc.kind==='sales_invoice'||doc.kind==='purchase_invoice'?(creditsByInvoice.get(doc.id)??0)/100:0
  if(doc.gross_amount===null||!Number.isFinite(gross)||gross<0||!Number.isSafeInteger(Math.round(gross*100))||!Number.isFinite(paid))
   return NextResponse.json({error:'Invalid financial amount in export'},{status:422})
  const invoice=doc.kind==='sales_invoice'||doc.kind==='purchase_invoice'
  const reconciliation=invoice?reconcileFinanceInvoice(Math.round(gross*100),byDocument.get(doc.id)??0,creditsByInvoice.get(doc.id)??0,doc.status):null
  const outstanding=doc.kind==='sales_invoice'||doc.kind==='purchase_invoice'?Math.max(0,Math.round((gross-paid-credits)*100)/100):0
  const overpayment=doc.kind==='sales_invoice'||doc.kind==='purchase_invoice'?Math.max(0,Math.round((paid+credits-gross)*100)/100):0
  rows.push([doc.id,doc.document_number,doc.kind,doc.status,doc.issue_date,doc.due_date,doc.currency,gross.toFixed(2),paid.toFixed(2),credits.toFixed(2),outstanding.toFixed(2),overpayment.toFixed(2),doc.kind==='sales_invoice'||doc.kind==='purchase_invoice'?(outstanding>0?financialAging(doc.due_date,today):'settled'):'not_applicable'])
 }
 return new NextResponse(financeCsv(rows),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="administration-finance.csv"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})
}
