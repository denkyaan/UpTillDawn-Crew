'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/crew-server'
import { markSaveSuccess } from '@/lib/save-success'

const GOD_COOKIE='uptilldawn-god-session'
const GOD_LOGIN='godmode@uptilldawn'

export async function configureGodMode(formData:FormData){
  const login=String(formData.get('login')||'').trim().toLowerCase()
  const password=String(formData.get('password')||'')
  const confirm=String(formData.get('confirm_password')||'')
  if(login!==GOD_LOGIN)throw new Error(`God Mode login moet ${GOD_LOGIN} zijn.`)
  if(password.length<10)throw new Error('God Mode wachtwoord moet minstens 10 tekens bevatten.')
  if(password!==confirm)throw new Error('Wachtwoorden komen niet overeen.')

  const s=await createClient()
  const {data:{user}}=await s.auth.getUser()
  if(!user)throw new Error('Meld eerst aan als maker van de app.')
  const {data:isOwner}=await s.rpc('upt_current_is_owner')
  if(isOwner!==true)throw new Error('Alleen de maker kan God Mode configureren.')

  const {error}=await s.rpc('upt_god_set_credentials',{p_login:login,p_password:password})
  if(error){
    console.error('[God Mode] Setup failed',{code:error.code})
    throw new Error('God Mode kon niet worden geconfigureerd.')
  }

  const {data:token,error:sessionError}=await s.rpc('upt_god_login_owner')
  if(sessionError||!token)throw new Error('God Mode werd opgeslagen maar de nieuwe sessie kon niet starten.')

  const store=await cookies()
  store.set(GOD_COOKIE,token,{httpOnly:true,secure:true,sameSite:'strict',path:'/',maxAge:2*60*60})
  await markSaveSuccess()
  redirect('/god-mode')
}

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
