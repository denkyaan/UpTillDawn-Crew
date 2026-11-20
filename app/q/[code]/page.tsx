import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/crew-server'

export const dynamic='force-dynamic'

export default async function QrResourcePage({params}:{params:Promise<{code:string}>}){
  const {code}=await params
  const s=await createClient()
  const {data:{user}}=await s.auth.getUser()
  if(!user)redirect('/login?next=/q/'+encodeURIComponent(code))
  const {data,error}=await s.rpc('upt_resolve_qr_resource',{p_code:code})
  if(error||!data||typeof data!=='object'||Array.isArray(data))redirect('/qr')
  const route=(data as {route?:unknown}).route
  if(typeof route!=='string'||!route.startsWith('/')||route.startsWith('//')||route.includes('://'))redirect('/qr')
  redirect(route)
}
