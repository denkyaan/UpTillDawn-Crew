import AdministrationAccessNotice from '@/components/administration/portal-access-notice'
import SalesPage from '@/app/(app)/sales/page'
import {administrationPageAccess as administrationAccess} from '@/lib/administration/page-access'

export const dynamic='force-dynamic'

export default async function AdministrationSales({searchParams}:{searchParams:Promise<{event?:string;workplace?:string}>}){
 const access=await administrationAccess()
 if(!access.ok)return <AdministrationAccessNotice status={access.status}/>
 if(!access.user.realIsAdmin)return <AdministrationAccessNotice status={403}/>
 return SalesPage({searchParams})
}
