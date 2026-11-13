import AdministrationModulePage from "../[slug]/page"

export const dynamic = "force-dynamic"

/** Preserve action deep links in the existing Events workspace. */
export default function Page({searchParams}:{searchParams?:Promise<{create?:string}>}){
 return AdministrationModulePage({params:Promise.resolve({slug:"events"}),searchParams})
}
