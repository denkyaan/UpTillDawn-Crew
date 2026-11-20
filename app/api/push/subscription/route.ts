import { z } from "zod"
import { createClient } from "@/lib/supabase/crew-server"
import { getCurrentUser } from "@/lib/actions/auth"
import { readStrictJson } from "@/lib/strict-json-body"
import { safePushEndpoint } from "@/lib/push-security"
import { parseUiLocale } from "@/lib/locale-preferences"

const subscriptionSchema=z.object({
  endpoint:z.string().url().max(4096).refine(safePushEndpoint),
  keys:z.object({
    p256dh:z.string().min(20).max(512),
    auth:z.string().min(8).max(256),
  }),
  locale:z.string().optional(),
})
const removeSchema=z.object({endpoint:z.string().url().max(4096).refine(safePushEndpoint)})

function crossSite(request:Request){
  const fetchSite=request.headers.get("sec-fetch-site")
  if(fetchSite==="cross-site")return true
  const origin=request.headers.get("origin")
  return Boolean(origin&&origin!==new URL(request.url).origin)
}

export async function POST(request:Request){
  if(crossSite(request))return Response.json({error:"Ongeldige oorsprong."},{status:403})
  const user=await getCurrentUser()
  if(!user)return Response.json({error:"Aanmelden vereist."},{status:401})
  let body:unknown
  try{body=await readStrictJson(request,8192)}
  catch(error){return Response.json({error:"Ongeldige push-subscriptie."},{status:error instanceof Error&&error.message==='too_large'?413:400})}
  const parsed=subscriptionSchema.safeParse(body)
  if(!parsed.success)return Response.json({error:"Ongeldige push-subscriptie."},{status:400})

  const s=await createClient()
  const {data,error}=await s.rpc("upt_save_push_subscription",{
    p_endpoint:parsed.data.endpoint,
    p_p256dh:parsed.data.keys.p256dh,
    p_auth:parsed.data.keys.auth,
    p_user_agent:(request.headers.get("user-agent")||"").slice(0,500)||undefined,
    p_locale:parseUiLocale(parsed.data.locale)||"nl",
  })
  if(error){
    console.error("[Push] save subscription",error.code)
    return Response.json({error:"Push-subscriptie opslaan mislukt."},{status:500})
  }
  return Response.json({ok:true,id:data})
}

export async function DELETE(request:Request){
  if(crossSite(request))return Response.json({error:"Ongeldige oorsprong."},{status:403})
  const user=await getCurrentUser()
  if(!user)return Response.json({error:"Aanmelden vereist."},{status:401})
  let body:unknown
  try{body=await readStrictJson(request,8192)}
  catch(error){return Response.json({error:"Ongeldige push-subscriptie."},{status:error instanceof Error&&error.message==='too_large'?413:400})}
  const parsed=removeSchema.safeParse(body)
  if(!parsed.success)return Response.json({error:"Ongeldige push-subscriptie."},{status:400})

  const s=await createClient()
  const {error}=await s.rpc("upt_remove_push_subscription",{p_endpoint:parsed.data.endpoint})
  if(error){
    console.error("[Push] remove subscription",error.code)
    return Response.json({error:"Push-subscriptie verwijderen mislukt."},{status:500})
  }
  return Response.json({ok:true})
}
