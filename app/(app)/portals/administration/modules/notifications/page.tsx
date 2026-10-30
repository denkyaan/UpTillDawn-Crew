import AdministrationAccessNotice from '@/components/administration/portal-access-notice'
import NotificationsPage from '@/app/(app)/notifications/page'
import {administrationPageAccess as administrationAccess} from '@/lib/administration/page-access'
export const dynamic='force-dynamic'
export default async function AdministrationNotifications(){
 const access=await administrationAccess()
 if(!access.ok)return <AdministrationAccessNotice status={access.status}/>
 return <NotificationsPage/>
}
