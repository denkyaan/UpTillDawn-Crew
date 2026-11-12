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
  store.delete('uptilldawn-last-workspace')
  redirect('/login/admin')
}

/** Leaving God Mode is an explicit, reviewed navigation action. Keep the
 * Supabase account signed in, but clear privileged God session and restore
 * operational Admin mode. This also updates the installed PWA launch hint. */
export async function returnToNormalAppFromGodMode(){
  const s=await createClient()
  const {data:{user}}=await s.auth.getUser()
  if(!user)redirect('/login/admin')
  const {data:isOwner,error:ownerError}=await s.rpc('upt_current_is_owner')
  if(ownerError||isOwner!==true)redirect('/unauthorized')
  const {data:role,error:roleError}=await s.rpc('upt_set_admin_role_mode',{p_role:'admin'})
  if(roleError||role!=='admin')redirect('/maker-mode?portal=admin&error=role-mode')
  const store=await cookies()
  const token=store.get(GOD_COOKIE)?.value
  if(token)await s.rpc('upt_god_logout',{p_token:token})
  store.delete(GOD_COOKIE)
  store.set('uptilldawn-last-workspace',user.id+':admin',{sameSite:'lax',secure:true,path:'/',maxAge:60*60*24*90})
  redirect('/admin')
}
