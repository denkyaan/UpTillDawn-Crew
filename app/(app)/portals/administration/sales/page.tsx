import {redirect} from 'next/navigation'
import SalesPage from '@/app/(app)/sales/page'
import {administrationAccess} from '@/lib/administration/access'

export const dynamic='force-dynamic'

export default async function AdministrationSales({searchParams}:{searchParams:Promise<{event?:string;workplace?:string}>}){
 const access=await administrationAccess()
 if(!access.ok)redirect('/portals')
 if(!access.user.realIsAdmin)redirect('/portals/administration')
 return SalesPage({searchParams})
}
