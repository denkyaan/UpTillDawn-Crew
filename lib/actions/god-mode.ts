'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/crew-server'

const GOD_COOKIE='uptilldawn-god-session'

export async function enterGodModeFromMakerSession(){
  const s=await createClient()
  const {data:{user}}=await s.auth.getUser()
  if(!user)redirect('/login/admin')

  const {data:isOwner}=await s.rpc('upt_current_is_owner')
  if(isOwner!==true)redirect('/unauthorized')

  const {data:token,error}=await s.rpc('upt_god_login_owner')
  if(error||!token){
    console.error('[God Mode] Maker session start failed',{code:error?.code})
    redirect('/maker-mode?error=god-mode')
  }

  const store=await cookies()
  store.set(GOD_COOKIE,String(token),{httpOnly:true,secure:true,sameSite:'strict',path:'/',maxAge:2*60*60})
  redirect('/god-mode')
}

export async function godModeLogout(){
  const store=await cookies()
  const token=store.get(GOD_COOKIE)?.value
  if(token){
    const s=await createClient()
    await s.rpc('upt_god_logout',{p_token:token})
  }
  store.delete(GOD_COOKIE)
  redirect('/login/admin')
}
