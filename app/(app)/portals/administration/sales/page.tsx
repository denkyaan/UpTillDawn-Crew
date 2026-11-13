import {redirect} from 'next/navigation'
import SalesPage from '@/app/(app)/sales/page'
import {administrationAccess} from '@/lib/administration/access'

export const dynamic='force-dynamic'

export default async function AdministrationSales({searchParams}:{searchParams:Promise<{event?:string;workplace?:string}>}){
 const access=await administrationAccess()
 if(!access.ok)redirect('/portals')
 // Administrative staff must not be sent back to the overview from the
 // canonical Sales subtab. SalesPage applies the signed-in user's RLS and
 // restricts management actions to the effective Admin role.
 return SalesPage({searchParams})
}
