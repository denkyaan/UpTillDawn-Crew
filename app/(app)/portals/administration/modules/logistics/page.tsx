import AdministrationModulePage from "../[slug]/page"

export const dynamic = "force-dynamic"

export default function Page({searchParams}:{searchParams:Promise<{page?:string;status?:string}>}){
 return AdministrationModulePage({params:Promise.resolve({slug:"logistics"}),searchParams})
}
