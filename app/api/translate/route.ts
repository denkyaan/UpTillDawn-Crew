import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/crew-server'

export const dynamic='force-dynamic'

const bodySchema=z.object({
  text:z.string().trim().min(1).max(4000),
  target:z.enum(['nl','fr','en','de']),
})

export async function POST(request:Request){
  const s=await createClient()
  const {data:{user}}=await s.auth.getUser()
  if(!user)return NextResponse.json({error:'UNAUTHORIZED'},{status:401})

  const parsed=bodySchema.safeParse(await request.json().catch(()=>null))
  if(!parsed.success)return NextResponse.json({error:'INVALID_REQUEST'},{status:400})

  const endpoint=process.env.TRANSLATION_API_URL?.trim()
  if(!endpoint)return NextResponse.json({error:'TRANSLATION_PROVIDER_UNCONFIGURED'},{status:503})

  const apiKey=process.env.TRANSLATION_API_KEY?.trim()
  const controller=new AbortController()
  const timeout=setTimeout(()=>controller.abort(),12000)

  try{
    const response=await fetch(endpoint,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        q:parsed.data.text,
        source:'auto',
        target:parsed.data.target,
        format:'text',
        ...(apiKey?{api_key:apiKey}:{}),
      }),
      cache:'no-store',
      signal:controller.signal,
    })
    if(!response.ok)return NextResponse.json({error:'TRANSLATION_PROVIDER_FAILED'},{status:502})
    const data=await response.json() as {translatedText?:unknown}
    if(typeof data.translatedText!=='string'||!data.translatedText.trim()){
      return NextResponse.json({error:'TRANSLATION_PROVIDER_FAILED'},{status:502})
    }
    return NextResponse.json({translatedText:data.translatedText})
  }catch{
    return NextResponse.json({error:'TRANSLATION_PROVIDER_FAILED'},{status:502})
  }finally{
    clearTimeout(timeout)
  }
}
