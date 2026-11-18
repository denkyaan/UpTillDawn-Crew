import { createClient } from "@/lib/supabase/crew-server"
import { getCurrentUser } from "@/lib/actions/auth"

export const dynamic="force-dynamic"

export async function GET(){
  const user=await getCurrentUser()
  if(!user)return Response.json({error:"Aanmelden vereist."},{status:401})
  const s=await createClient()

  const [{data:publicKey,error:keyError},{data:unreadCount,error:countError}]=await Promise.all([
    s.rpc("upt_push_public_key"),
    s.rpc("upt_notification_badge_count"),
  ])
  if(keyError||!publicKey)return Response.json({error:"Push is nog niet geconfigureerd."},{status:503})
  if(countError)console.error("[Push] unread count",countError.code)

  return Response.json({publicKey,unreadCount:unreadCount??0},{headers:{"cache-control":"no-store"}})
}
