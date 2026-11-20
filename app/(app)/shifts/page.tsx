import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/actions/auth'

export const dynamic='force-dynamic'

export default async function Page(){
  const current=await getCurrentUser()
  if(!current)return null
  redirect('/workplaces')
}
