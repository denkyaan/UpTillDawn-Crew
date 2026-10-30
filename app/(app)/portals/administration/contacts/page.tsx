import AdministrationAccessNotice from '@/components/administration/portal-access-notice'
import {administrationPageAccess} from '@/lib/administration/page-access'
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/actions/auth"
import { createClient } from "@/lib/supabase/crew-server"
import { canOpenPortal, type PortalAssignment } from "@/lib/portal-access"
import { requestUiLocale } from "@/lib/server-locale"

const path="/portals/administration/contacts"
async function access(){
 const user=await getCurrentUser()
 if(!user)redirect("/login")
 if(!user.approved||user.account_blocked)redirect("/portals")
 const db=await createClient()
 if(!user.isAdmin){
  const {data,error}=await db.rpc("upt_my_portal_assignments")
  if(error||!canOpenPortal("administration",(data??[]) as PortalAssignment[],{approved:user.approved,blocked:Boolean(user.account_blocked)}))redirect("/portals")
 }
 return db
}
async function addContact(form:FormData){
 "use server"
 const db=await access()
 const name=String(form.get("name")??"").trim().slice(0,180)
 const kind=String(form.get("kind")??"")
 const email=String(form.get("email")??"").trim().slice(0,254)
 const vat=String(form.get("vat")??"").trim().slice(0,40)
 if(!name||!["customer","supplier","both"].includes(kind)||email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return
 const {error}=await db.from("admin_counterparties").insert({name,kind,email:email||null,vat_number:vat||null})
 if(error)throw new Error("Unable to save counterparty")
 revalidatePath(path)
}
export const dynamic="force-dynamic"
export default async function ContactsPage(){
 const pageAccess=await administrationPageAccess()
 if(!pageAccess.ok)return <AdministrationAccessNotice status={pageAccess.status}/>
 const db=await access()
 const locale=await requestUiLocale()
 const labels=({
  nl:{title:"Contacten en leveranciers",intro:"Beheer klanten, leveranciers en hun facturatiegegevens.",name:"Naam",type:"Soort",email:"E-mail",vat:"Btw-nummer",save:"Contact toevoegen",empty:"Nog geen contacten",customer:"Klant",supplier:"Leverancier",both:"Beide",error:"Contacten kunnen niet worden geladen."},
  fr:{title:"Contacts et fournisseurs",intro:"Gérez les clients, fournisseurs et leurs données de facturation.",name:"Nom",type:"Type",email:"E-mail",vat:"N° TVA",save:"Ajouter",empty:"Aucun contact",customer:"Client",supplier:"Fournisseur",both:"Les deux",error:"Contacts indisponibles."},
  en:{title:"Contacts and suppliers",intro:"Manage customers, suppliers and billing details.",name:"Name",type:"Type",email:"Email",vat:"VAT number",save:"Add contact",empty:"No contacts yet",customer:"Customer",supplier:"Supplier",both:"Both",error:"Contacts unavailable."},
  de:{title:"Kontakte und Lieferanten",intro:"Kunden, Lieferanten und Rechnungsdaten verwalten.",name:"Name",type:"Typ",email:"E-Mail",vat:"USt-ID",save:"Kontakt hinzufügen",empty:"Noch keine Kontakte",customer:"Kunde",supplier:"Lieferant",both:"Beide",error:"Kontakte nicht verfügbar."}
 } as const)[locale]
 const {data,error}=await db.from("admin_counterparties").select("id,name,kind,email,vat_number").order("name").limit(100)
 return <main className="mx-auto w-full max-w-5xl space-y-5 p-4 sm:p-6">
  <header><h1 className="text-2xl font-bold">{labels.title}</h1><p className="mt-2 text-sm text-muted-foreground">{labels.intro}</p></header>
  <form action={addContact} className="grid gap-3 rounded-2xl border bg-card p-5 sm:grid-cols-2">
   <label className="text-sm font-semibold">{labels.name}<input required name="name" maxLength={180} className="mt-1 w-full rounded-lg border bg-background p-3"/></label>
   <label className="text-sm font-semibold">{labels.type}<select name="kind" className="mt-1 w-full rounded-lg border bg-background p-3"><option value="supplier">{labels.supplier}</option><option value="customer">{labels.customer}</option><option value="both">{labels.both}</option></select></label>
   <label className="text-sm font-semibold">{labels.email}<input type="email" name="email" className="mt-1 w-full rounded-lg border bg-background p-3"/></label>
   <label className="text-sm font-semibold">{labels.vat}<input name="vat" maxLength={40} className="mt-1 w-full rounded-lg border bg-background p-3"/></label>
   <button className="rounded-xl bg-violet-600 px-4 py-3 font-semibold text-white sm:col-span-2">{labels.save}</button>
  </form>
  <section className="space-y-2">{error?<p>{labels.error}</p>:data?.length?data.map(item=><article key={item.id} className="rounded-xl border bg-card p-4"><div className="font-semibold">{item.name}</div><p className="mt-1 text-xs text-muted-foreground">{item.kind==="supplier"?labels.supplier:item.kind==="customer"?labels.customer:labels.both} · {item.email||"—"} · {item.vat_number||"—"}</p></article>):<p className="rounded-xl border p-5 text-sm text-muted-foreground">{labels.empty}</p>}</section>
 </main>
}
