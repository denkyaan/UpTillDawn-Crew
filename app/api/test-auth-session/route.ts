import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/types/crew-database'
import { z } from 'zod'
import { readStrictJson } from '@/lib/strict-json-body'

export async function POST(request:NextRequest){
  // The QA session exchange must never be reachable from the production deployment,
  // even if an operator accidentally copies the QA enablement flag.
  const isIsolatedMainQA = process.env.UPT_E2E_SESSION_BRIDGE === '1'
    && process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://npbjrtiolqperdgljnhi.supabase.co'
    && process.env.NEXT_PUBLIC_APP_URL === 'https://uptilldawn-main.uptilldawn.workers.dev'
  if (!isIsolatedMainQA) return NextResponse.json({error:'Not found'},{status:404})
  // The Main QA bridge must accept only calls from its own browser origin.
  // Reject forged browser cross-origin requests before Supabase Auth work.
  const origin=request.headers.get('origin')
  const fetchSite=request.headers.get('sec-fetch-site')
  if(origin!==process.env.NEXT_PUBLIC_APP_URL||(fetchSite&&fetchSite!=='same-origin'))
    return NextResponse.json({error:'Forbidden'},{status:403,headers:{'Cache-Control':'no-store'}})
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
    return NextResponse.json({error:'Invalid test session'},{status:415})
  let raw:unknown
  try{raw=await readStrictJson(request,16_384)}
  catch(error){return NextResponse.json({error:'Invalid test session'},{
    status:error instanceof Error&&error.message==='too_large'?413:400,
  })}
  const parsed=z.object({
    access_token:z.string().min(1).max(12_000),
    refresh_token:z.string().min(1).max(4_096),
  }).strict().safeParse(raw)
  if(!parsed.success)return NextResponse.json({error:'Invalid test session'},{status:400})
  const response=NextResponse.json({ok:true})
  const supabase=createServerClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{cookies:{getAll(){return request.cookies.getAll()},setAll(cookiesToSet){cookiesToSet.forEach(({name,value,options})=>response.cookies.set(name,value,options))}}})
  const {data,error}=await supabase.auth.setSession({access_token:parsed.data.access_token,refresh_token:parsed.data.refresh_token})
  if(error||!data.session)return NextResponse.json({error:'Test session rejected'},{status:401})
  return response
}
