import {NextResponse} from 'next/server'
import type {SupabaseClient} from '@supabase/supabase-js'
import {administrationAccess} from '@/lib/administration/access'
import {financeCsv} from '@/lib/administration/finance-report'
import {validateTicketSalesSummary} from '@/lib/administration/ticket-sales-summary'

export const dynamic='force-dynamic'
/** Download stored ticket sales only. No live Eventix/SumUp sync is implied. */
export async function GET(request:Request){
 const access=await administrationAccess()
 if(!access.ok)return NextResponse.json({error:'forbidden'},{status:access.status,headers:{'Cache-Control':'no-store'}})
 const {data,error}=await (access.db as unknown as SupabaseClient).rpc('upt_ticket_sales_summary')
 if(error||!Array.isArray(data))return NextResponse.json({error:'report_unavailable'},{status:503,headers:{'Cache-Control':'no-store'}})
 if(!validateTicketSalesSummary(data)){
  return NextResponse.json({error:'invalid_report_data'},{status:503,headers:{'Cache-Control':'no-store'}})
 }
 const eventId=new URL(request.url).searchParams.get('event')
 if(eventId!==null&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId))return NextResponse.json({error:'invalid_event'},{status:400,headers:{'Cache-Control':'no-store'}})
 const selected=eventId===null?data:data.filter(row=>row.event_id.toLowerCase()===eventId.toLowerCase())
 const csv=financeCsv([['event_id','source','sale_rows','quantity','gross_cents'],...selected.map(row=>[row.event_id,row.source,row.sale_rows,row.quantity,row.gross_cents])])
 return new NextResponse(csv,{status:200,headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="ticket-sales.csv"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})
}
