import {LazyStaffEvents} from '@/components/crew/lazy-staff-events'
import {getCurrentUser} from '@/lib/actions/auth'

// This entrypoint keeps manager-only SSR and server-action graphs OUT of the
// Staff navigation path. Authentication remains server-verified; no role
// checks, actions or privileged queries are moved into the browser.
export const dynamic='force-dynamic'
export default async function Page({searchParams}:{searchParams?:Promise<{event?:string}>}){
 const user=await getCurrentUser()
 if(!user)return null
 if(user.role==='staff'){
  const params=searchParams?await searchParams:{}
  return <LazyStaffEvents userId={user.id} focusEvent={params.event}/>
 }
 // Load the full management tree only after the verified role check.
 const {default:ManagementPage}=await import('./manager-page')
 return <ManagementPage searchParams={searchParams}/>
}
