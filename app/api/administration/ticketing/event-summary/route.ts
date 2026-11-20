import {NextResponse} from 'next/server'
import type {SupabaseClient} from '@supabase/supabase-js'
import {administrationAccess} from '@/lib/administration/access'
import {financeCsv} from '@/lib/administration/finance-report'
import {validateTicketSalesSummary,ticketSalesByEvent} from '@/lib/administration/ticket-sales-summary'

export const dynamic='force-dynamic'
/** Aggregate persisted sales by event; this does not contact payment providers. */
export async function GET(){
 const access=await administrationAccess()
 if(!access.ok)return NextResponse.json({error:'forbidden'},{status:access.status,headers:{'Cache-Control':'no-store'}})
 const {data,error}=await (access.db as unknown as SupabaseClient).rpc('upt_ticket_sales_summary')
 if(error||!Array.isArray(data))return NextResponse.json({error:'report_unavailable'},{status:503,headers:{'Cache-Control':'no-store'}})
 if(!validateTicketSalesSummary(data))return NextResponse.json({error:'invalid_report_data'},{status:503,headers:{'Cache-Control':'no-store'}})
 const events=ticketSalesByEvent(data)
 const csv=financeCsv([['event_id','source_count','sale_rows','quantity','gross_cents'],...events.map(event=>[event.eventId,String(event.sourceCount),String(event.saleRows),String(event.quantity),String(event.grossCents)])])
 return new NextResponse(csv,{status:200,headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="ticket-event-summary.csv"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})
}
