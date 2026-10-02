import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/types/crew-database'

export async function POST(request:NextRequest){
  if(process.env.UPT_E2E_SESSION_BRIDGE!=='1')return NextResponse.json({error:'Not found'},{status:404})
  const body=await request.json().catch(()=>null) as {access_token?:string;refresh_token?:string}|null
  if(!body?.access_token||!body?.refresh_token)return NextResponse.json({error:'Invalid test session'},{status:400})
  const response=NextResponse.json({ok:true})
  const supabase=createServerClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{cookies:{getAll(){return request.cookies.getAll()},setAll(cookiesToSet){cookiesToSet.forEach(({name,value,options})=>response.cookies.set(name,value,options))}}})
  const {data,error}=await supabase.auth.setSession({access_token:body.access_token,refresh_token:body.refresh_token})
  if(error||!data.session)return NextResponse.json({error:'Test session rejected'},{status:401})
  return response
}
