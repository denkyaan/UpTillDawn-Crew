import AdministrationModulePage from "../[slug]/page"

export const dynamic = "force-dynamic"
type DocumentSearchParams={event?:string}

export default function Page({searchParams}:{searchParams:Promise<DocumentSearchParams>}){
 return AdministrationModulePage({params:Promise.resolve({slug:"documents"}),searchParams})
}
