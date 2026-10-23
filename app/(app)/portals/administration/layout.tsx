import { AdministrationNavigation } from "@/components/administration/administration-navigation"
export default function AdministrationLayout({children}:{children:React.ReactNode}){
 return <><div className="pb-20 lg:pb-0">{children}</div><AdministrationNavigation/></>
}
