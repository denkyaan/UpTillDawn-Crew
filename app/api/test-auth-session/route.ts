import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/crew-server'

export async function POST(request:NextRequest){
  if(process.env.NODE_ENV==='production')return NextResponse.json({error:'Not found'},{status:404})
  const body=await request.json().catch(()=>null) as {access_token?:string;refresh_token?:string}|null
  if(!body?.access_token||!body?.refresh_token)return NextResponse.json({error:'Invalid test session'},{status:400})
  const supabase=await createClient()
  const {data,error}=await supabase.auth.setSession({access_token:body.access_token,refresh_token:body.refresh_token})
  if(error||!data.session)return NextResponse.json({error:'Test session rejected'},{status:401})
  return NextResponse.json({ok:true})
}
