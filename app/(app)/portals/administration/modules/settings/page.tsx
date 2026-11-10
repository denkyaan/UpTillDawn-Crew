import AdministrationModulePage from "../[slug]/page"
import BillingProfile from '@/components/administration/billing-profile'

export const dynamic = "force-dynamic"

export default async function Page({searchParams}:{searchParams:Promise<{billing?:string}>}){
 const params=await searchParams
 let stage="workspace"
 try{
  const workspace=await AdministrationModulePage({params:Promise.resolve({slug:"settings"})})
  stage="billing"
  const billing=await BillingProfile({failed:params.billing==='error'})
  return <>{workspace}{billing}</>
 }catch(error){
  // Isolated CI only: error names/stacks identify the source of an unavailable
  // Settings page without exposing user data, provider secrets or the database.
  if(process.env.UPT_E2E_SESSION_BRIDGE==="1"){
   const diagnosis=error instanceof Error?error:{name:typeof error,message:"non-Error rejection",stack:""}
   console.error("UPT_SETTINGS_RENDER_FAILURE",stage,diagnosis.name,diagnosis.message,String(diagnosis.stack??"").split("\n").slice(0,7).join("\n"))
  }
  throw error
 }
}
