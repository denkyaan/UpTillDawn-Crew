import {getCurrentUser} from "@/lib/actions/auth"
import {requestUiLocale} from "@/lib/server-locale"
import {redirect} from "next/navigation"
import {AdministrationPersonnelClient} from "@/components/administration/administration-personnel-client"

export const dynamic="force-dynamic"

// The protected Administration layout still verifies the user's live portal
// authorization on the server; the crew directory now loads from the browser
// through the existing authenticated, RLS-controlled Supabase endpoint.
export default async function AdministrationPersonnel(){
 const user=await getCurrentUser()
 if(!user)redirect("/login")
 const locale=await requestUiLocale()
 return <AdministrationPersonnelClient initialLocale={locale} currentUserId={user.id}/>
}
