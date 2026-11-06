import {redirect} from 'next/navigation'
import NotificationsPage from '@/app/(app)/notifications/page'
import {administrationAccess} from '@/lib/administration/access'
export const dynamic='force-dynamic'
export default async function AdministrationNotifications({searchParams}:{searchParams:Promise<{page?:string}>}){
 const access=await administrationAccess()
 if(!access.ok)redirect('/portals')
 const {page}=await searchParams
 return <NotificationsPage searchParams={Promise.resolve({page,scope:'administration'})}/>
}
