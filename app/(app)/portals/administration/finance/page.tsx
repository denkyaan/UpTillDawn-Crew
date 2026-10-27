import {financialAging} from '@/lib/administration/finance-report'
import type { SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { validateUploadSecurity, safeUploadName } from '@/lib/upload-security'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/crew-server'
import { canOpenPortal, type PortalAssignment } from '@/lib/portal-access'
import { requestUiLocale } from '@/lib/server-locale'

const copy = {
 nl: {title:'Financiële administratie',intro:'Registreer conceptdocumenten. Definitieve goedkeuring en Peppol-verzending zijn nog niet actief.',new:'Nieuw concept',kind:'Documenttype',number:'Documentnummer',net:'Bedrag excl. btw',tax:'Btw-bedrag',notes:'Notities',save:'Concept opslaan',empty:'Nog geen financiële documenten.',back:'Administratie',error:'Document kon niet worden opgeslagen.',currency:'Valuta', totals:'Financieel overzicht', count:'Documenten', outstanding:'Nog niet betaald', paid:'Betaald', draft:'Concepten'},
 fr: {title:'Administration financière',intro:'Enregistrez des brouillons. La validation définitive et l’envoi Peppol ne sont pas encore actifs.',new:'Nouveau brouillon',kind:'Type de document',number:'Numéro du document',net:'Montant hors TVA',tax:'Montant TVA',notes:'Notes',save:'Enregistrer le brouillon',empty:'Aucun document financier.',back:'Administration',error:'Impossible d’enregistrer le document.',currency:'Devise', totals:'Vue financière', count:'Documents', outstanding:'Non payés', paid:'Payés', draft:'Brouillons'},
 en: {title:'Financial administration',intro:'Record draft documents. Final approval and Peppol sending are not active yet.',new:'New draft',kind:'Document type',number:'Document number',net:'Net amount',tax:'VAT amount',notes:'Notes',save:'Save draft',empty:'No financial documents yet.',back:'Administration',error:'Document could not be saved.',currency:'Currency', totals:'Financial overview', count:'Documents', outstanding:'Unpaid', paid:'Paid', draft:'Drafts'},
 de: {title:'Finanzverwaltung',intro:'Erfasse Entwürfe. Endgültige Freigabe und Peppol-Versand sind noch nicht aktiv.',new:'Neuer Entwurf',kind:'Dokumenttyp',number:'Dokumentnummer',net:'Nettobetrag',tax:'MwSt.-Betrag',notes:'Notizen',save:'Entwurf speichern',empty:'Noch keine Finanzdokumente.',back:'Verwaltung',error:'Dokument konnte nicht gespeichert werden.',currency:'Währung', totals:'Finanzübersicht', count:'Dokumente', outstanding:'Unbezahlt', paid:'Bezahlt', draft:'Entwürfe'},
} as const

const documentKinds = {
 nl: ['Aankoopfactuur','Verkoopfactuur','Uitgave','Creditnota','Offerte'],
 fr: ['Facture d’achat','Facture de vente','Dépense','Note de crédit','Devis'],
 en: ['Purchase invoice','Sales invoice','Expense','Credit note','Quote'],
 de: ['Eingangsrechnung','Ausgangsrechnung','Ausgabe','Gutschrift','Angebot'],
} as const
const kindValues = ['purchase_invoice','sales_invoice','expense','credit_note','quote'] as const

const uploadLabels = {
 nl:{upload:'Bijlage toevoegen',file:'Factuur, bestelbon of betalingsbewijs (PDF of afbeelding, max. 20 MB)',attachments:'Bijlagen',failed:'Bijlage kon niet worden opgeslagen.'},
 fr:{upload:'Ajouter une pièce jointe',file:'Facture, bon de commande ou preuve de paiement (PDF ou image, 20 Mo max.)',attachments:'Pièces jointes',failed:'Impossible d’enregistrer le fichier.'},
 en:{upload:'Attach document',file:'Invoice, purchase order or payment proof (PDF or image, max 20 MB)',attachments:'Attachments',failed:'Attachment could not be saved.'},
 de:{upload:'Beleg hinzufügen',file:'Rechnung, Bestellung oder Zahlungsnachweis (PDF oder Bild, max. 20 MB)',attachments:'Anhänge',failed:'Anhang konnte nicht gespeichert werden.'},
} as const
const actionLabels = {
 nl: {review:'Ter controle indienen',approved:'Goedkeuren (Admin)',issued:'Als uitgereikt markeren',paid:'Als betaald markeren',void:'Annuleren'},
 fr: {review:'Soumettre à vérification',approved:'Approuver (Admin)',issued:'Marquer comme émis',paid:'Marquer comme payé',void:'Annuler'},
 en: {review:'Submit for review',approved:'Approve (Admin)',issued:'Mark as issued',paid:'Mark as paid',void:'Void'},
 de: {review:'Zur Prüfung einreichen',approved:'Genehmigen (Admin)',issued:'Als ausgestellt markieren',paid:'Als bezahlt markieren',void:'Stornieren'},
} as const
const transitions:Record<string,string[]> = {draft:['review'],review:['approved'],approved:['issued','paid','void'],issued:['paid','void']}
const statusLabels = {
 nl: {draft:'Concept',review:'Ter controle',approved:'Goedgekeurd',issued:'Uitgereikt',paid:'Betaald',void:'Geannuleerd'},
 fr: {draft:'Brouillon',review:'À vérifier',approved:'Approuvé',issued:'Émis',paid:'Payé',void:'Annulé'},
 en: {draft:'Draft',review:'In review',approved:'Approved',issued:'Issued',paid:'Paid',void:'Void'},
 de: {draft:'Entwurf',review:'In Prüfung',approved:'Genehmigt',issued:'Ausgestellt',paid:'Bezahlt',void:'Storniert'},
} as const
const kindLabels = {
 nl: {sales_invoice:'Verkoopfactuur',purchase_invoice:'Aankoopfactuur',credit_note:'Creditnota',expense:'Uitgave',quote:'Offerte'},
 fr: {sales_invoice:'Facture de vente',purchase_invoice:'Facture d’achat',credit_note:'Note de crédit',expense:'Dépense',quote:'Devis'},
 en: {sales_invoice:'Sales invoice',purchase_invoice:'Purchase invoice',credit_note:'Credit note',expense:'Expense',quote:'Quote'},
 de: {sales_invoice:'Ausgangsrechnung',purchase_invoice:'Eingangsrechnung',credit_note:'Gutschrift',expense:'Ausgabe',quote:'Angebot'},
} as const
function translatedLabel<T extends string>(labels:Record<string,T>,value:string):string {
 return labels[value] ?? value
}


async function requireAdministration() {
 const current = await getCurrentUser()
 if (!current) redirect('/login')
 if ((!current.approved || Boolean(current.account_blocked)) && !current.isOwner) redirect('/portals')
 const supabase = await createClient()
 const { data, error } = await supabase.rpc('upt_my_portal_assignments')
 if (error && !current.isAdmin && !current.isOwner) redirect('/portals')
 if (!current.isAdmin && !current.isOwner && !canOpenPortal('administration',(data ?? []) as PortalAssignment[],{
   approved:current.approved,blocked:current.account_blocked===true,
 })) redirect('/portals')
 return {supabase,isAdmin:current.isAdmin || current.isOwner}
}

async function createDraft(formData:FormData) {
 'use server'
 const {supabase} = await requireAdministration()
 const kind = String(formData.get('kind') ?? '')
 const allowed = ['sales_invoice','purchase_invoice','credit_note','expense','quote']
 if (!allowed.includes(kind)) return
 const net = Number(formData.get('net_amount'))
 const tax = Number(formData.get('tax_amount'))
 if (!Number.isFinite(net) || !Number.isFinite(tax) || net < 0 || tax < 0 || net > 999999999 || tax > 999999999) return
 const documentNumber = String(formData.get('document_number') ?? '').trim().slice(0,100)
 const notes = String(formData.get('notes') ?? '').trim().slice(0,2000)
 const originalInvoiceId=String(formData.get('original_invoice_id')??'')
 if(kind==='credit_note'){
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(originalInvoiceId))redirect('/portals/administration/finance?error=1')
  const {data:original}=await supabase.from('admin_financial_documents').select('id,kind,status').eq('id',originalInvoiceId).single()
  if(!original||!['sales_invoice','purchase_invoice'].includes(original.kind)||!['approved','issued','paid'].includes(original.status))redirect('/portals/administration/finance?error=1')
 }

 const { error } = await supabase.from('admin_financial_documents').insert({
   kind, document_number:documentNumber || null, net_amount:net, tax_amount:tax,
   notes:notes || null, status:'draft', currency:'EUR',
   original_invoice_id:kind==='credit_note'?originalInvoiceId:null,
 })
 if (error) redirect('/portals/administration/finance?error=1')
 revalidatePath('/portals/administration/finance')
 redirect('/portals/administration/finance')
}

async function addInvoiceLine(formData:FormData) {
 'use server'
 const {supabase}=await requireAdministration()
 const documentId=String(formData.get('document_id')??'')
 const description=String(formData.get('description')??'').trim()
 const quantity=Number(formData.get('quantity'))
 const unitPrice=Number(formData.get('unit_price'))
 const vatRate=Number(formData.get('vat_rate'))
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(documentId)||!description||description.length>500||![quantity,unitPrice,vatRate].every(Number.isFinite)||quantity<=0||quantity>100000||unitPrice<0||unitPrice>999999999||vatRate<0||vatRate>100)redirect('/portals/administration/finance?error=1')
 const {data:document}=await supabase.from('admin_financial_documents').select('id,status').eq('id',documentId).single()
 if(!document||document.status!=='draft')redirect('/portals/administration/finance?error=1')
 const {error}=await supabase.from('admin_financial_lines').insert({document_id:documentId,description,quantity,unit_price:unitPrice,vat_rate:vatRate})
 if(error)redirect('/portals/administration/finance?error=1')
 revalidatePath('/portals/administration/finance')
 redirect('/portals/administration/finance')
}

async function removeInvoiceLine(formData:FormData) {
 'use server'
 const {supabase}=await requireAdministration()
 const documentId=String(formData.get('document_id')??'')
 const lineId=String(formData.get('line_id')??'')
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
 if(!uuid.test(documentId)||!uuid.test(lineId))redirect('/portals/administration/finance?error=1')
 const {data:document,error:lookupError}=await supabase.from('admin_financial_documents').select('id,status').eq('id',documentId).single()
 if(lookupError||document?.status!=='draft')redirect('/portals/administration/finance?error=1')
 const {data:deleted,error}=await supabase.from('admin_financial_lines').delete().eq('id',lineId).eq('document_id',documentId).select('id')
 if(error||deleted?.length!==1)redirect('/portals/administration/finance?error=1')
 revalidatePath('/portals/administration/finance')
 redirect('/portals/administration/finance')
}

async function createPaymentReminder(formData:FormData) {
 'use server'
 const {supabase}=await requireAdministration()
 const documentId=String(formData.get('document_id')??'')
 const recipient=String(formData.get('recipient_email')??'').trim()
 const subject=String(formData.get('subject')??'').trim()
 const body=String(formData.get('body')??'').trim()
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
 if(!uuid.test(documentId)||recipient.length<3||recipient.length>320||!recipient.includes('@')||subject.length<1||subject.length>200||body.length<1||body.length>10000)redirect('/portals/administration/finance?error=1')
 const {data:existing,error:lookupError}=await (supabase as unknown as SupabaseClient).from('admin_payment_reminders').select('reminder_number').eq('document_id',documentId).order('reminder_number',{ascending:false}).limit(1)
 if(lookupError)redirect('/portals/administration/finance?error=1')
 const next=(Number(existing?.[0]?.reminder_number??0))+1
 if(next>9)redirect('/portals/administration/finance?error=1')
 const {error}=await (supabase as unknown as SupabaseClient).from('admin_payment_reminders').insert({document_id:documentId,reminder_number:next,recipient_email:recipient,subject,body,status:'draft'})
 if(error)redirect('/portals/administration/finance?error=1')
 revalidatePath('/portals/administration/finance')
 redirect('/portals/administration/finance')
}

async function updatePaymentReminder(formData:FormData) {
 'use server'
 const {supabase,isAdmin}=await requireAdministration()
 const id=String(formData.get('reminder_id')??'')
 const status=String(formData.get('status')??'')
 if(!isAdmin||!['approved','cancelled'].includes(status)||!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id))redirect('/portals/administration/finance?error=1')
 const {data:{user}}=await supabase.auth.getUser()
 if(!user)redirect('/login')
 const patch=status==='approved'?{status,approved_by:user.id,approved_at:new Date().toISOString()}:{status}
 const {data,error}=await (supabase as unknown as SupabaseClient).from('admin_payment_reminders').update(patch).eq('id',id).eq('status','draft').select('id')
 if(error||data?.length!==1)redirect('/portals/administration/finance?error=1')
 revalidatePath('/portals/administration/finance')
 redirect('/portals/administration/finance')
}

async function recordFinancialPayment(formData:FormData) {
 'use server'
 const {supabase}=await requireAdministration()
 const documentId=String(formData.get('document_id')??'')
 const amount=Number(formData.get('amount'))
 const paidOn=String(formData.get('paid_on')??'')
 const bankReference=String(formData.get('bank_reference')??'').trim()
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
 if(!uuid.test(documentId)||!Number.isFinite(amount)||amount<=0||amount>999999999||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(paidOn)||bankReference.length>200)redirect('/portals/administration/finance?error=1')
 const {data:document}=await supabase.from('admin_financial_documents').select('status').eq('id',documentId).single()
 if(!document||!['approved','issued','paid'].includes(document.status))redirect('/portals/administration/finance?error=1')
 const {error}=await (supabase as unknown as SupabaseClient).from('admin_financial_payments').insert({
  document_id:documentId,amount,paid_on:paidOn,bank_reference:bankReference||null
 })
 if(error)redirect('/portals/administration/finance?error=1')
 revalidatePath('/portals/administration/finance')
 redirect('/portals/administration/finance')
}

async function updateFinancialStatus(formData:FormData) {
 'use server'
 const {supabase,isAdmin} = await requireAdministration()
 const id = String(formData.get('document_id') ?? '')
 const status = String(formData.get('status') ?? '')
 if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return
 const allowed = isAdmin ? ['review','approved','issued','paid','void'] : ['review']
 if (!allowed.includes(status)) return
 const {data:existing,error:lookupError} = await supabase.from('admin_financial_documents').select('status').eq('id',id).single()
 if (lookupError || !existing) return
 const transitions:Record<string,string[]> = {
  draft:['review'],review:['approved'],approved:['issued','paid','void'],issued:['paid','void']
 }
 if (!transitions[existing.status]?.includes(status)) return
 const {data:{user}} = await supabase.auth.getUser()
 if (!user) return
 const patch:{status:string;approved_by?:string;approved_at?:string} = {status}
 if (status==='approved') {patch.approved_by=user.id;patch.approved_at=new Date().toISOString()}
 const {error} = await supabase.from('admin_financial_documents').update(patch).eq('id',id).eq('status',existing.status)
 if (error) redirect('/portals/administration/finance?error=1')
 revalidatePath('/portals/administration/finance')
 redirect('/portals/administration/finance')
}

async function uploadFinancialAttachment(formData:FormData) {
 'use server'
 const {supabase} = await requireAdministration()
 const documentId=String(formData.get('document_id')??'')
 const file=formData.get('file')
 if(!/^[0-9a-f-]{36}$/i.test(documentId) || !(file instanceof File)) return
 const {data:document}=await supabase.from('admin_financial_documents').select('id,status').eq('id',documentId).single()
 if(!document || !['draft','review'].includes(document.status)) return
 let validation
 try {validation=await validateUploadSecurity(file)} catch {redirect('/portals/administration/finance?error=1')}
 if(!['application/pdf','image/jpeg','image/png','image/webp'].includes(validation.mime)) redirect('/portals/administration/finance?error=1')
 const {data:{user}}=await supabase.auth.getUser()
 if(!user) return
 const path=user.id+'/'+randomUUID()+'.'+validation.extension
 const {error:uploadError}=await supabase.storage.from('admin-financial-attachments').upload(path,file,{contentType:validation.mime,upsert:false})
 if(uploadError) redirect('/portals/administration/finance?error=1')
 const {error:linkError}=await (supabase as unknown as SupabaseClient).from('admin_financial_attachments').insert({
  document_id:documentId,storage_path:path,original_name:safeUploadName(file.name),
  mime_type:validation.mime,size_bytes:validation.size,uploaded_by:user.id
 })
 if(linkError) redirect('/portals/administration/finance?error=1')
 revalidatePath('/portals/administration/finance')
 redirect('/portals/administration/finance')
}

export const dynamic = 'force-dynamic'
export default async function FinancePage({searchParams}:{searchParams:Promise<{error?:string}>}) {
 const {supabase,isAdmin} = await requireAdministration()
 const locale = await requestUiLocale()
 const t = copy[locale]
 const params = await searchParams
 const {data:documents,error} = await supabase.from('admin_financial_documents')
   .select('id,kind,document_number,net_amount,tax_amount,gross_amount,currency,status,created_at,original_invoice_id,due_date')
   .order('created_at',{ascending:false}).limit(100)
 const originalInvoices=(documents??[]).filter(d=>['sales_invoice','purchase_invoice'].includes(d.kind)&&['approved','issued','paid'].includes(d.status))
 const {data:paymentRows}=await (supabase as unknown as SupabaseClient).from('admin_financial_payments').select('id,document_id,amount,paid_on,bank_reference').order('created_at',{ascending:false}).limit(1000)
 const payments=(paymentRows??[]) as {id:string;document_id:string;amount:number;paid_on:string;bank_reference:string|null}[]
 const {data:reminderRows}=await (supabase as unknown as SupabaseClient).from('admin_payment_reminders').select('id,document_id,reminder_number,status,recipient_email,subject,created_at').order('created_at',{ascending:false}).limit(500)
 const reminders=(reminderRows??[]) as {id:string;document_id:string;reminder_number:number;status:string;recipient_email:string;subject:string;created_at:string}[]
 const {data:lines}=await supabase.from('admin_financial_lines').select('id,document_id,description,quantity,unit_price,vat_rate').order('created_at',{ascending:true}).limit(500)
 const {data:attachments}=await (supabase as unknown as SupabaseClient).from('admin_financial_attachments').select('id,document_id,original_name,created_at').order('created_at',{ascending:false}).limit(200)
 const money = (amount:number) => new Intl.NumberFormat(locale==='nl'?'nl-BE':locale==='fr'?'fr-BE':locale==='de'?'de-BE':'en-BE',{style:'currency',currency:'EUR'}).format(amount)
 const paymentTotalFor=(id:string)=>payments.filter(p=>p.document_id===id).reduce((sum,p)=>sum+Number(p.amount),0)
 const paidTotal=(documents??[]).filter(d=>['approved','issued','paid'].includes(d.status)).reduce((sum,d)=>sum+paymentTotalFor(d.id),0)
 const unpaidTotal=(documents??[]).filter(d=>['approved','issued','paid','review'].includes(d.status)).reduce((sum,d)=>sum+Math.max(0,Number(d.gross_amount)-paymentTotalFor(d.id)),0)
 const today=new Date().toISOString().slice(0,10)
 const overdueDocuments=(documents??[]).filter(d=>['approved','issued'].includes(d.status)&&Number(d.gross_amount)>paymentTotalFor(d.id)&&d.due_date&&d.due_date<today)
 const overdueTotal=overdueDocuments.reduce((sum,d)=>sum+Math.max(0,Number(d.gross_amount)-paymentTotalFor(d.id)),0)
 const agingCounts={overdue_1_30:0,overdue_31_60:0,overdue_61_plus:0}
 for(const d of overdueDocuments){const bucket=financialAging(d.due_date,today);if(bucket in agingCounts)agingCounts[bucket as keyof typeof agingCounts]++}
 const draftCount=(documents??[]).filter(d=>d.status==='draft').length
 return <main className="mx-auto max-w-5xl space-y-6 p-4 pb-28 md:p-8">
  <Link className="text-violet-400" href="/portals/administration">← {t.back}</Link>
  <header><h1 className="text-3xl font-black">{t.title}</h1><p className="mt-2 text-muted-foreground">{t.intro}</p></header>
  <section className="rounded-2xl border bg-card p-5"><h2 className="mb-3 font-bold">{t.totals}</h2><div className="grid gap-3 sm:grid-cols-4">{[[t.count,String(documents?.length??0)],[t.draft,String(draftCount)],[t.outstanding,money(unpaidTotal)],[t.paid,money(paidTotal)]].map(([label,value])=><div key={label} className="rounded-lg border p-3"><p className="text-sm text-muted-foreground">{label}</p><strong>{value}</strong></div>)}</div></section>
  <section className="rounded-2xl border bg-card p-5 space-y-3">
   <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold">{({nl:'Vervallen facturen',fr:'Factures échues',en:'Overdue invoices',de:'Überfällige Rechnungen'} as const)[locale]}</h2><a href="/api/administration/finance/export" className="rounded-lg border border-violet-500 px-3 py-2 text-sm font-semibold text-violet-400">{({nl:'Financieel CSV-overzicht exporteren',fr:'Exporter le rapport financier CSV',en:'Export finance CSV report',de:'Finanzbericht als CSV exportieren'} as const)[locale]}</a></div>
   <p className="text-sm">{({nl:'Totaal vervallen',fr:'Total échu',en:'Total overdue',de:'Gesamt überfällig'} as const)[locale]}: <strong>{money(overdueTotal)}</strong></p>
   <div className="grid grid-cols-3 gap-2 text-xs">{([['1–30',agingCounts.overdue_1_30],['31–60',agingCounts.overdue_31_60],['61+',agingCounts.overdue_61_plus]] as const).map(([label,count])=><div key={label} className="rounded-lg border p-3"><p>{label} {({nl:'dagen',fr:'jours',en:'days',de:'Tage'} as const)[locale]}</p><strong>{count}</strong></div>)}</div>
   <p className="text-xs text-muted-foreground">{({nl:'Overzicht op basis van de recentste 100 documenten; CSV bevat alle beschikbare documenten binnen de exportlimiet.',fr:'Vue basée sur les 100 derniers documents ; le CSV comprend les documents disponibles dans la limite d’export.',en:'Dashboard uses the latest 100 documents; CSV includes available records within export limits.',de:'Übersicht der letzten 100 Dokumente; CSV enthält verfügbare Datensätze innerhalb des Exportlimits.'} as const)[locale]}</p>
  </section>
  <section className="rounded-2xl border bg-card p-5">
   <h2 className="mb-4 text-lg font-bold">{t.new}</h2>
   <form action={createDraft} className="grid gap-3 sm:grid-cols-2">
    <label className="space-y-1 text-sm">{t.kind}<select name="kind" required className="block w-full rounded-lg border bg-background p-3">{kindValues.map((kind,index)=><option key={kind} value={kind}>{documentKinds[locale][index]}</option>)}</select></label>
    <label className="space-y-1 text-sm sm:col-span-2">{({nl:'Oorspronkelijke factuur (verplicht bij creditnota)',fr:'Facture d’origine (obligatoire pour un avoir)',en:'Original invoice (required for credit note)',de:'Ursprüngliche Rechnung (bei Gutschrift erforderlich)'} as const)[locale]}<select name="original_invoice_id" className="block w-full rounded-lg border bg-background p-3"><option value="">—</option>{originalInvoices.map(invoice=><option key={invoice.id} value={invoice.id}>{invoice.document_number||invoice.id} · {money(Number(invoice.gross_amount))}</option>)}</select></label>
    <label className="space-y-1 text-sm">{t.number}<input name="document_number" maxLength={100} className="block w-full rounded-lg border bg-background p-3"/></label>
    <label className="space-y-1 text-sm">{t.net}<input name="net_amount" type="number" min="0" max="999999999" step="0.01" required className="block w-full rounded-lg border bg-background p-3"/></label>
    <label className="space-y-1 text-sm">{t.tax}<input name="tax_amount" type="number" min="0" max="999999999" step="0.01" required className="block w-full rounded-lg border bg-background p-3"/></label>
    <label className="space-y-1 text-sm sm:col-span-2">{t.notes}<textarea name="notes" maxLength={2000} className="block w-full rounded-lg border bg-background p-3"/></label>
    <button type="submit" className="rounded-lg bg-violet-600 px-4 py-3 font-semibold text-white">{t.save}</button>
   </form>
   {params.error==='1' && <p role="alert" className="mt-3 text-sm text-red-400">{t.error}</p>}
  </section>
  <section className="rounded-2xl border bg-card p-5">
   {error ? <p role="alert">{t.error}</p> : !documents?.length ? <p className="text-muted-foreground">{t.empty}</p> :
    <div className="space-y-3">{documents.map(d=><article key={d.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
     <div><p className="font-semibold">{d.document_number || translatedLabel(kindLabels[locale],d.kind)}</p><p className="text-xs text-muted-foreground">{translatedLabel(kindLabels[locale],d.kind)} · {translatedLabel(statusLabels[locale],d.status)}{d.original_invoice_id&&<> · {({nl:'Factuur',fr:'Facture',en:'Invoice',de:'Rechnung'} as const)[locale]}: {documents?.find(invoice=>invoice.id===d.original_invoice_id)?.document_number||d.original_invoice_id}</>}</p></div>
     <div className="w-full space-y-2">
      {['approved','issued','paid'].includes(d.status)&&<div className="rounded-lg border p-3 text-xs">
       <p>{({nl:'Geregistreerde betalingen',fr:'Paiements enregistrés',en:'Recorded payments',de:'Erfasste Zahlungen'} as const)[locale]}: {money(paymentTotalFor(d.id))}</p>
       <p>{({nl:'Openstaand saldo',fr:'Solde restant',en:'Outstanding balance',de:'Offener Betrag'} as const)[locale]}: {money(Math.max(0,Number(d.gross_amount)-payments.filter(p=>p.document_id===d.id).reduce((sum,p)=>sum+Number(p.amount),0)))}</p>
       {payments.filter(p=>p.document_id===d.id).map(p=><p key={p.id}>{p.paid_on} · {money(Number(p.amount))} {p.bank_reference||''}</p>)}
       {Number(d.gross_amount)>paymentTotalFor(d.id)&&<form action={recordFinancialPayment} className="mt-2 grid gap-2 sm:grid-cols-4">
        <input type="hidden" name="document_id" value={d.id}/>
        <input name="amount" aria-label={({nl:'Betalingsbedrag',fr:'Montant du paiement',en:'Payment amount',de:'Zahlungsbetrag'} as const)[locale]} type="number" min="0.01" step="0.01" required className="rounded border bg-background p-2"/>
        <input name="paid_on" aria-label={({nl:'Betaaldatum',fr:'Date du paiement',en:'Payment date',de:'Zahlungsdatum'} as const)[locale]} type="date" required className="rounded border bg-background p-2"/>
        <input name="bank_reference" aria-label={({nl:'Bankreferentie',fr:'Référence bancaire',en:'Bank reference',de:'Bankreferenz'} as const)[locale]} maxLength={200} className="rounded border bg-background p-2"/>
        <button type="submit" className="rounded border border-violet-500 px-3 py-2 text-violet-400">{({nl:'Betaling registreren',fr:'Enregistrer le paiement',en:'Record payment',de:'Zahlung erfassen'} as const)[locale]}</button>
       </form>}
      </div>}
      {['sales_invoice','purchase_invoice'].includes(d.kind)&&['approved','issued'].includes(d.status)&&d.due_date&&d.due_date<today&&Number(d.gross_amount)>paymentTotalFor(d.id)&&<div className="space-y-2 rounded-lg border p-3 text-xs">
       <h3 className="font-semibold">{({nl:'Betalingsherinneringen (geen automatische verzending)',fr:'Rappels de paiement (aucun envoi automatique)',en:'Payment reminders (no automatic sending)',de:'Zahlungserinnerungen (kein automatischer Versand)'} as const)[locale]}</h3>
       {reminders.filter(r=>r.document_id===d.id).map(r=><div key={r.id} className="flex flex-wrap items-center gap-2"><span>#{r.reminder_number} · {r.subject} · {r.recipient_email} · {r.status}</span>{isAdmin&&r.status==='draft'&&(['approved','cancelled'] as const).map(status=><form key={status} action={updatePaymentReminder}><input type="hidden" name="reminder_id" value={r.id}/><input type="hidden" name="status" value={status}/><button type="submit" className="rounded border px-2 py-1">{status==='approved'?({nl:'Goedkeuren',fr:'Approuver',en:'Approve',de:'Genehmigen'} as const)[locale]:({nl:'Annuleren',fr:'Annuler',en:'Cancel',de:'Stornieren'} as const)[locale]}</button></form>)}</div>)}
       <form action={createPaymentReminder} className="grid gap-2 sm:grid-cols-2">
        <input type="hidden" name="document_id" value={d.id}/>
        <input type="email" name="recipient_email" required maxLength={320} aria-label={({nl:'E-mailadres ontvanger',fr:'E-mail du destinataire',en:'Recipient email',de:'Empfänger-E-Mail'} as const)[locale]} placeholder="email@example.com" className="rounded border bg-background p-2"/>
        <input name="subject" required maxLength={200} aria-label={({nl:'Onderwerp herinnering',fr:'Objet du rappel',en:'Reminder subject',de:'Betreff der Erinnerung'} as const)[locale]} placeholder={({nl:'Betalingsherinnering',fr:'Rappel de paiement',en:'Payment reminder',de:'Zahlungserinnerung'} as const)[locale]} className="rounded border bg-background p-2"/>
        <textarea name="body" required maxLength={10000} aria-label={({nl:'Tekst herinnering',fr:'Texte du rappel',en:'Reminder message',de:'Erinnerungstext'} as const)[locale]} className="rounded border bg-background p-2 sm:col-span-2" rows={3}/>
        <button type="submit" className="rounded border border-violet-500 px-3 py-2 text-violet-400 sm:col-span-2">{({nl:'Herinnering als concept bewaren',fr:'Enregistrer le rappel en brouillon',en:'Save reminder draft',de:'Erinnerungsentwurf speichern'} as const)[locale]}</button>
       </form>
      </div>}
      {(attachments??[]).filter(a=>a.document_id===d.id).map(a=><p key={a.id} className="text-xs text-muted-foreground">{uploadLabels[locale].attachments}: {a.original_name}</p>)}
      {(lines??[]).filter(line=>line.document_id===d.id).map(line=><div key={line.id} className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><p>{line.description} · {line.quantity} × {money(Number(line.unit_price))} · {line.vat_rate}%</p>{d.status==='draft'&&<form action={removeInvoiceLine}><input type="hidden" name="document_id" value={d.id}/><input type="hidden" name="line_id" value={line.id}/><button type="submit" className="rounded border px-2 py-1 text-red-400">{({nl:'Regel verwijderen',fr:'Supprimer la ligne',en:'Remove line',de:'Position entfernen'} as const)[locale]}</button></form>}</div>)}
      {d.status==='draft'&&<form action={addInvoiceLine} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-5">
       <input type="hidden" name="document_id" value={d.id}/>
       <input name="description" aria-label={({nl:"Omschrijving",fr:"Description",en:"Description",de:"Beschreibung"} as const)[locale]} placeholder={({nl:'Omschrijving',fr:'Description',en:'Description',de:'Beschreibung'} as const)[locale]} maxLength={500} required className="rounded border bg-background p-2 text-xs sm:col-span-2"/>
       <input name="quantity" aria-label={({nl:"Aantal",fr:"Quantité",en:"Quantity",de:"Menge"} as const)[locale]} type="number" min="0.001" max="100000" step="0.001" defaultValue="1" required className="rounded border bg-background p-2 text-xs"/>
       <input name="unit_price" aria-label={({nl:"Eenheidsprijs",fr:"Prix unitaire",en:"Unit price",de:"Einzelpreis"} as const)[locale]} type="number" min="0" max="999999999" step="0.0001" placeholder="€" required className="rounded border bg-background p-2 text-xs"/>
       <input name="vat_rate" aria-label={({nl:"Btw-percentage",fr:"Pourcentage TVA",en:"VAT percentage",de:"Mehrwertsteuersatz"} as const)[locale]} type="number" min="0" max="100" step="0.01" defaultValue="21" required className="rounded border bg-background p-2 text-xs"/>
       <button type="submit" className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white sm:col-span-5">{({nl:'Factuurregel toevoegen',fr:'Ajouter une ligne',en:'Add invoice line',de:'Rechnungsposition hinzufügen'} as const)[locale]}</button>
      </form>}
      {['draft','review'].includes(d.status)&&<form action={uploadFinancialAttachment} encType="multipart/form-data" className="flex flex-wrap items-end gap-2">
       <input type="hidden" name="document_id" value={d.id}/>
       <label className="text-xs">{uploadLabels[locale].file}<input name="file" type="file" required accept=".pdf,.jpg,.jpeg,.png,.webp" className="block max-w-64 text-xs"/></label>
       <button className="rounded-lg border border-violet-500 px-3 py-2 text-xs font-semibold text-violet-400" type="submit">{uploadLabels[locale].upload}</button>
      </form>}
     </div>
     <div className="flex flex-wrap items-center gap-2">
     {(transitions[d.status]??[]).filter(next=>(isAdmin || next==='review') && (next!=='paid' || (Number(d.gross_amount)>0 && paymentTotalFor(d.id)===Number(d.gross_amount))) && (next!=='void' || paymentTotalFor(d.id)===0)).map(next=><form key={next} action={updateFinancialStatus}><input type="hidden" name="document_id" value={d.id}/><input type="hidden" name="status" value={next}/><button type="submit" className="rounded-lg border border-violet-500 px-3 py-2 text-xs font-semibold text-violet-400">{translatedLabel(actionLabels[locale],next)}</button></form>)}
     <strong>{new Intl.NumberFormat(locale==='nl'?'nl-BE':locale==='fr'?'fr-BE':locale==='de'?'de-BE':'en-BE',{style:'currency',currency:d.currency}).format(Number(d.gross_amount))}</strong></div>
    </article>)}</div>}
  </section>
 </main>
}
