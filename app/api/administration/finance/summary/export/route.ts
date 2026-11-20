import {NextResponse} from 'next/server'
import type {SupabaseClient} from '@supabase/supabase-js'
import {administrationAccess} from '@/lib/administration/access'
import {financeCsv} from '@/lib/administration/finance-report'
import {financeSummaryKeys,validateFinanceSummary} from '@/lib/administration/finance-summary'

export const dynamic='force-dynamic'
/** Read-only CSV of approved invoice reconciliation status counts. */
export async function GET(){
 const access=await administrationAccess()
 if(!access.ok)return NextResponse.json({error:'forbidden'},{status:access.status,headers:{'Cache-Control':'no-store'}})
 const {data,error}=await (access.db as unknown as SupabaseClient).rpc('upt_administration_finance_summary')
 if(error)return NextResponse.json({error:'report_unavailable'},{status:503,headers:{'Cache-Control':'no-store'}})
 if(!validateFinanceSummary(data))return NextResponse.json({error:'invalid_report_data'},{status:503,headers:{'Cache-Control':'no-store'}})
 const csv=financeCsv([['status','invoice_count'],...financeSummaryKeys.map(key=>[key,data[key]])])
 return new NextResponse(csv,{status:200,headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="invoice-reconciliation-summary.csv"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})
}
