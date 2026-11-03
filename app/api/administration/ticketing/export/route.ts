import {NextResponse} from 'next/server'
import type {SupabaseClient} from '@supabase/supabase-js'
import {administrationAccess} from '@/lib/administration/access'
import {financeCsv} from '@/lib/administration/finance-report'

export const dynamic='force-dynamic'
type TicketSummary={event_id:string;source:string;sale_rows:string;quantity:string;gross_cents:string}
const digits=(value:unknown)=>typeof value==='string'&&/^\\d+$/.test(value)&&BigInt(value)<=BigInt(Number.MAX_SAFE_INTEGER)
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Download stored ticket sales only. No live Eventix/SumUp sync is implied. */
export async function GET(){
 const access=await administrationAccess()
 if(!access.ok)return NextResponse.json({error:'forbidden'},{status:access.status,headers:{'Cache-Control':'no-store'}})
 const {data,error}=await (access.db as unknown as SupabaseClient).rpc('upt_ticket_sales_summary')
 if(error||!Array.isArray(data))return NextResponse.json({error:'report_unavailable'},{status:503,headers:{'Cache-Control':'no-store'}})
 const rows=data as TicketSummary[]
 if(rows.length>10000||!rows.every(row=>row&&typeof row.event_id==='string'&&uuid.test(row.event_id)&&typeof row.source==='string'&&row.source.length<=160&&digits(row.sale_rows)&&digits(row.quantity)&&digits(row.gross_cents))){
  return NextResponse.json({error:'invalid_report_data'},{status:503,headers:{'Cache-Control':'no-store'}})
 }
 const csv=financeCsv([['event_id','source','sale_rows','quantity','gross_cents'],...rows.map(row=>[row.event_id,row.source,row.sale_rows,row.quantity,row.gross_cents])])
 return new NextResponse(csv,{status:200,headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="ticket-sales.csv"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})
}
