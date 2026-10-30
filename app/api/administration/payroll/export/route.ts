import {NextResponse} from 'next/server'
import type {SupabaseClient} from '@supabase/supabase-js'
import {administrationAccess} from '@/lib/administration/access'
import {payrollCsv,type PayrollRow} from '@/lib/administration/payroll-export'

export const dynamic='force-dynamic'
export async function GET(request:Request){
 const access=await administrationAccess()
 if(!access.ok)return NextResponse.json({error:'access_denied'},{status:access.status})
 const event=new URL(request.url).searchParams.get('event')??''
 if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(event))return NextResponse.json({error:'event_required'},{status:422})
 // A single transaction assembles the snapshot; reject truncation instead of exporting a sample.
 const {data,error}=await (access.db as unknown as SupabaseClient).rpc('upt_administration_payroll_rows',{p_event:event})
 if(error)return NextResponse.json({error:'payroll_unavailable'},{status:409})
 if(!Array.isArray(data)||data.length>10000)return NextResponse.json({error:'export_too_large'},{status:413})
 if(!data.length)return NextResponse.json({error:'no_approved_timesheets'},{status:422})
 try{
  return new NextResponse(payrollCsv(data as PayrollRow[]),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="approved-payroll-'+event+'.csv"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})
 }catch{return NextResponse.json({error:'invalid_payroll_data'},{status:409})}
}
