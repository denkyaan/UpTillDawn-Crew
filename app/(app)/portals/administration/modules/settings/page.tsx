import AdministrationModulePage from "../[slug]/page"
import BillingProfile from '@/components/administration/billing-profile'

export const dynamic = "force-dynamic"

export default async function Page({searchParams}:{searchParams:Promise<{billing?:string}>}){
 const params=await searchParams
 return <>{await AdministrationModulePage({params:Promise.resolve({slug:"settings"})})}<BillingProfile failed={params.billing==='error'}/></>
}
