import Link from "next/link"
import {notFound,redirect} from "next/navigation"
import {getCurrentUser} from "@/lib/actions/auth"
import {createClient} from "@/lib/supabase/crew-server"
import {canOpenPortal,type PortalAssignment} from "@/lib/portal-access"
import {requestUiLocale} from "@/lib/server-locale"

export default async function InvoiceDetails({params}:{params:Promise<{id:string}>}){
 const {id}=await params
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id))notFound()
 const current=await getCurrentUser()
 if(!current)redirect("/login")
 if((!current.approved||Boolean(current.account_blocked))&&!current.isOwner)redirect("/portals")
 const supabase=await createClient()
 const {data:assignments,error:accessError}=await supabase.rpc("upt_my_portal_assignments")
 if(accessError&&!current.isAdmin&&!current.isOwner)redirect("/portals")
 if(!current.isAdmin&&!current.isOwner&&!canOpenPortal("administration",(assignments??[]) as PortalAssignment[],{approved:current.approved,blocked:current.account_blocked===true}))redirect("/portals")
 const {data:doc,error}=await supabase.from("admin_financial_documents").select("id,kind,status,document_number,issue_date,due_date,currency,net_amount,tax_amount,gross_amount,notes").eq("id",id).in("kind",["sales_invoice","purchase_invoice"]).maybeSingle()
 if(error||!doc)notFound()
 const locale=await requestUiLocale()
 const labels={
  nl:{back:"Terug naar facturen",title:"Factuurdetails",number:"Factuurnummer",kind:"Type",status:"Status",issue:"Factuurdatum",due:"Vervaldatum",net:"Exclusief btw",tax:"Btw",gross:"Totaal",notes:"Notities",finance:"Open financiële administratie"},
  fr:{back:"Retour aux factures",title:"Détails de la facture",number:"Numéro",kind:"Type",status:"Statut",issue:"Date de facture",due:"Échéance",net:"Hors TVA",tax:"TVA",gross:"Total",notes:"Notes",finance:"Ouvrir l'administration financière"},
  en:{back:"Back to invoices",title:"Invoice details",number:"Invoice number",kind:"Type",status:"Status",issue:"Invoice date",due:"Due date",net:"Excluding VAT",tax:"VAT",gross:"Total",notes:"Notes",finance:"Open financial administration"},
  de:{back:"Zurück zu Rechnungen",title:"Rechnungsdetails",number:"Rechnungsnummer",kind:"Typ",status:"Status",issue:"Rechnungsdatum",due:"Fälligkeit",net:"Ohne MwSt.",tax:"MwSt.",gross:"Gesamt",notes:"Notizen",finance:"Finanzverwaltung öffnen"}
 }[locale]
 const money=(value:number|null)=>value==null?"—":new Intl.NumberFormat(locale==="nl"?"nl-BE":locale==="fr"?"fr-BE":locale==="de"?"de-DE":"en-GB",{minimumFractionDigits:2,maximumFractionDigits:2}).format(value)+" "+(doc.currency??"EUR")
 const fields=[[labels.number,doc.document_number],[labels.kind,doc.kind],[labels.status,doc.status],[labels.issue,doc.issue_date],[labels.due,doc.due_date],[labels.net,money(doc.net_amount)],[labels.tax,money(doc.tax_amount)],[labels.gross,money(doc.gross_amount)],[labels.notes,doc.notes]] as const
 return <main className="mx-auto max-w-3xl space-y-5 p-5"><Link href="/portals/administration/modules/invoices" className="text-sm underline">{labels.back}</Link><h1 className="text-2xl font-bold">{labels.title}</h1><dl className="grid gap-4 rounded-xl border p-5 sm:grid-cols-2">{fields.map(([label,value])=><div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="break-words font-medium">{value??"—"}</dd></div>)}</dl><Link href="/portals/administration/finance" className="inline-block rounded-lg border px-4 py-2 text-sm">{labels.finance}</Link></main>
}
