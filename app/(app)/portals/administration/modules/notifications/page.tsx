import {redirect} from 'next/navigation'
import NotificationsPage from '@/app/(app)/notifications/page'
import {administrationAccess} from '@/lib/administration/access'
export const dynamic='force-dynamic'
export default async function AdministrationNotifications(){
 const access=await administrationAccess()
 if(!access.ok)redirect('/portals')
 return <NotificationsPage/>
}
