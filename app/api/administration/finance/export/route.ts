import {NextResponse} from 'next/server'
import {getCurrentUser} from '@/lib/actions/auth'
import {createClient} from '@/lib/supabase/crew-server'
import {canOpenPortal,type PortalAssignment} from '@/lib/portal-access'
import {financeCsv,financialAging} from '@/lib/administration/finance-report'

export const dynamic='force-dynamic'
export async function GET(){
 const current=await getCurrentUser()
 if(!current)return NextResponse.json({error:'Unauthorized'},{status:401})
 const db=await createClient()
 if(!current.isOwner&&!current.realIsAdmin){
  const {data,error}=await db.rpc('upt_my_portal_assignments')
  if(error||!canOpenPortal('administration',(data??[]) as PortalAssignment[],{approved:current.approved,blocked:current.account_blocked===true}))
   return NextResponse.json({error:'Forbidden'},{status:403})
 }
 const documents: {id:string;kind:string;document_number:string|null;status:string;currency:string;gross_amount:number|null;due_date:string|null;issue_date:string|null}[]=[]
 const payments: {document_id:string;amount:number}[]=[]
 for(let offset=0;offset<10000;offset+=500){
  const {data,error}=await db.from('admin_financial_documents').select('id,kind,document_number,status,currency,gross_amount,due_date,issue_date').order('id').range(offset,offset+499)
  if(error)return NextResponse.json({error:'Financial documents unavailable'},{status:503})
  documents.push(...(data??[]))
  if((data??[]).length<500)break
 }
 if(documents.length>=10000)return NextResponse.json({error:'Export exceeds 10000 documents; narrow the dataset before exporting'},{status:413})
 const typed=db as unknown as {from:(name:string)=>{select:(columns:string)=>{order:(column:string)=>{range:(from:number,to:number)=>Promise<{data:{document_id:string;amount:number}[]|null;error:unknown}>}}}}
 for(let offset=0;offset<50000;offset+=500){
  const {data,error}=await typed.from('admin_financial_payments').select('document_id,amount').order('document_id').range(offset,offset+499)
  if(error)return NextResponse.json({error:'Payments unavailable'},{status:503})
  payments.push(...(data??[]))
  if((data??[]).length<500)break
 }
 if(payments.length>=50000)return NextResponse.json({error:'Export exceeds 50000 payments; narrow the dataset before exporting'},{status:413})
 const byDocument=new Map<string,number>()
 for(const payment of payments)byDocument.set(payment.document_id,(byDocument.get(payment.document_id)??0)+Number(payment.amount))
 const today=new Date().toISOString().slice(0,10)
 const rows:unknown[][]=[['Document ID','Number','Type','Status','Issue date','Due date','Currency','Gross amount','Paid amount','Outstanding amount','Aging']]
 for(const doc of documents){
  const paid=byDocument.get(doc.id)??0
  const outstanding=Math.max(0,Number(doc.gross_amount)-paid)
  rows.push([doc.id,doc.document_number,doc.kind,doc.status,doc.issue_date,doc.due_date,doc.currency,Number(doc.gross_amount).toFixed(2),paid.toFixed(2),outstanding.toFixed(2),outstanding>0?financialAging(doc.due_date,today):'settled'])
 }
 return new NextResponse(financeCsv(rows),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="administration-finance.csv"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})
}
