import {LazyStaffTasks} from '@/components/crew/lazy-staff-tasks'
import {getCurrentUser} from '@/lib/actions/auth'

// Keep the full manager task/checklist/inventory SSR graph off the Staff
// request path while retaining its original actions and RLS authorization.
export const dynamic='force-dynamic'
export default async function Page({searchParams}:{searchParams?:Promise<{event?:string;workplace?:string;user?:string}>}){
 const user=await getCurrentUser()
 if(!user)return null
 if(user.role==='staff')return <LazyStaffTasks userId={user.id}/>
 const {default:ManagementPage}=await import('./manager-page')
 return <ManagementPage searchParams={searchParams}/>
}
