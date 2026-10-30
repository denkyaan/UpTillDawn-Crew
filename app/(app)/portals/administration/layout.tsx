import { AdministrationNavigation } from "@/components/administration/administration-navigation"
import {requestUiLocale} from "@/lib/server-locale"
import {getCurrentUser} from "@/lib/actions/auth"
export default async function AdministrationLayout({children}:{children:React.ReactNode}){
 const [locale,user]=await Promise.all([requestUiLocale(),getCurrentUser()])
 return <><AdministrationNavigation initialLocale={locale} canManagePromotion={Boolean(user?.isAdmin||user?.isOwner)}/><div className="pb-64 lg:pb-0">{children}</div></>
}
