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
 const [{data:payments,error:paymentsError},{data:reminders,error:remindersError}]=await Promise.all([
  supabase.from("admin_financial_payments").select("id,amount,paid_on,bank_reference,note").eq("document_id",id).order("paid_on",{ascending:false}).limit(100),
  supabase.from("admin_payment_reminders").select("id,reminder_number,subject,recipient_email,status,created_at").eq("document_id",id).order("created_at",{ascending:false}).limit(100)
 ])
 const locale=await requestUiLocale()
 const labels={
  nl:{back:"Terug naar facturen",title:"Factuurdetails",number:"Factuurnummer",kind:"Type",status:"Status",issue:"Factuurdatum",due:"Vervaldatum",net:"Exclusief btw",tax:"Btw",gross:"Totaal",notes:"Notities",finance:"Open financiële administratie",payments:"Geregistreerde betalingen",reminders:"Betalingsherinneringen",none:"Geen registraties",loadError:"Gegevens konden niet geladen worden",paidOn:"Betaald op",reference:"Bankreferentie",recipient:"Ontvanger",recorded:"Geregistreerd",amount:"Bedrag"},
  fr:{back:"Retour aux factures",title:"Détails de la facture",number:"Numéro",kind:"Type",status:"Statut",issue:"Date de facture",due:"Échéance",net:"Hors TVA",tax:"TVA",gross:"Total",notes:"Notes",finance:"Ouvrir l'administration financière",payments:"Paiements enregistrés",reminders:"Rappels de paiement",none:"Aucun enregistrement",loadError:"Impossible de charger les données",paidOn:"Payé le",reference:"Référence bancaire",recipient:"Destinataire",recorded:"Enregistré",amount:"Montant"},
  en:{back:"Back to invoices",title:"Invoice details",number:"Invoice number",kind:"Type",status:"Status",issue:"Invoice date",due:"Due date",net:"Excluding VAT",tax:"VAT",gross:"Total",notes:"Notes",finance:"Open financial administration",payments:"Recorded payments",reminders:"Payment reminders",none:"No records",loadError:"Unable to load data",paidOn:"Paid on",reference:"Bank reference",recipient:"Recipient",recorded:"Recorded",amount:"Amount"},
  de:{back:"Zurück zu Rechnungen",title:"Rechnungsdetails",number:"Rechnungsnummer",kind:"Typ",status:"Status",issue:"Rechnungsdatum",due:"Fälligkeit",net:"Ohne MwSt.",tax:"MwSt.",gross:"Gesamt",notes:"Notizen",finance:"Finanzverwaltung öffnen",payments:"Erfasste Zahlungen",reminders:"Zahlungserinnerungen",none:"Keine Einträge",loadError:"Daten konnten nicht geladen werden",paidOn:"Bezahlt am",reference:"Bankreferenz",recipient:"Empfänger",recorded:"Erfasst",amount:"Betrag"}
 }[locale]
 const money=(value:number|null)=>value==null?"—":new Intl.NumberFormat(locale==="nl"?"nl-BE":locale==="fr"?"fr-BE":locale==="de"?"de-DE":"en-GB",{minimumFractionDigits:2,maximumFractionDigits:2}).format(value)+" "+(doc.currency??"EUR")
 const fields=[[labels.number,doc.document_number],[labels.kind,doc.kind],[labels.status,doc.status],[labels.issue,doc.issue_date],[labels.due,doc.due_date],[labels.net,money(doc.net_amount)],[labels.tax,money(doc.tax_amount)],[labels.gross,money(doc.gross_amount)],[labels.notes,doc.notes]] as const
 return <main className="mx-auto max-w-3xl space-y-5 p-5"><Link href="/portals/administration/modules/invoices" className="text-sm underline">{labels.back}</Link><h1 className="text-2xl font-bold">{labels.title}</h1><dl className="grid gap-4 rounded-xl border p-5 sm:grid-cols-2">{fields.map(([label,value])=><div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="break-words font-medium">{value??"—"}</dd></div>)}</dl><section className="space-y-3 rounded-xl border p-5"><h2 className="text-lg font-semibold">{labels.payments}</h2>{paymentsError?<p role="alert">{labels.loadError}</p>:!payments?.length?<p className="text-sm text-muted-foreground">{labels.none}</p>:<ul className="divide-y">{payments.map(payment=><li key={payment.id} className="grid gap-1 py-3 text-sm sm:grid-cols-3"><span>{labels.paidOn}: {payment.paid_on??"—"}</span><span>{labels.amount}: {money(payment.amount)}</span><span>{labels.reference}: {payment.bank_reference??"—"}</span>{payment.note&&<span className="sm:col-span-3">{payment.note}</span>}</li>)}</ul>}</section><section className="space-y-3 rounded-xl border p-5"><h2 className="text-lg font-semibold">{labels.reminders}</h2>{remindersError?<p role="alert">{labels.loadError}</p>:!reminders?.length?<p className="text-sm text-muted-foreground">{labels.none}</p>:<ul className="divide-y">{reminders.map(reminder=><li key={reminder.id} className="grid gap-1 py-3 text-sm sm:grid-cols-2"><span>#{reminder.reminder_number} · {reminder.status}</span><span>{labels.recorded}: {reminder.created_at?.slice(0,10)??"—"}</span><span>{reminder.subject}</span><span>{labels.recipient}: {reminder.recipient_email??"—"}</span></li>)}</ul>}</section><Link href="/portals/administration/finance" className="inline-block rounded-lg border px-4 py-2 text-sm">{labels.finance}</Link></main>
}
