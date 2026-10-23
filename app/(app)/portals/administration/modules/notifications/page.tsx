import AdministrationModulePage from "../[slug]/page"

export const dynamic = "force-dynamic"

export default function Page(){
 return AdministrationModulePage({params:Promise.resolve({slug:"notifications"})})
}
