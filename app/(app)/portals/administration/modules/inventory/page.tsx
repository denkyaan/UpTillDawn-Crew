import AdministrationModulePage from "../[slug]/page"

export const dynamic = "force-dynamic"

export default function Page({searchParams}:{searchParams:Promise<{event?:string}>}){
 return AdministrationModulePage({params:Promise.resolve({slug:"inventory"}),searchParams})
}
