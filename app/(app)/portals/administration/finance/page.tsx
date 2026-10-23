import type { SupabaseClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/crew-server'
import { canOpenPortal, type PortalAssignment } from '@/lib/portal-access'
import { requestUiLocale } from '@/lib/server-locale'

const copy = {
 nl: {title:'Financiële administratie',intro:'Registreer conceptdocumenten. Definitieve goedkeuring en Peppol-verzending zijn nog niet actief.',new:'Nieuw concept',kind:'Documenttype',number:'Documentnummer',net:'Bedrag excl. btw',tax:'Btw-bedrag',notes:'Notities',save:'Concept opslaan',empty:'Nog geen financiële documenten.',back:'Administratie',error:'Document kon niet worden opgeslagen.',currency:'Valuta',review:'Ter controle',approve:'Goedkeuren',void:'Ongeldig maken',actionError:'Statuswijziging mislukt.',due:'Vervaldatum',party:'Klant of leverancier',none:'Geen relatie',issue:'Factuurdatum',status:'Status',total:'Totaal',overdue:'Vervallen'},
 fr: {title:'Administration financière',intro:'Enregistrez des brouillons. La validation définitive et l’envoi Peppol ne sont pas encore actifs.',new:'Nouveau brouillon',kind:'Type de document',number:'Numéro du document',net:'Montant hors TVA',tax:'Montant TVA',notes:'Notes',save:'Enregistrer le brouillon',empty:'Aucun document financier.',back:'Administration',error:'Impossible d’enregistrer le document.',currency:'Devise',review:'À vérifier',approve:'Approuver',void:'Annuler',actionError:'Échec du changement de statut.',due:'Échéance',party:'Client ou fournisseur',none:'Aucun contact',issue:'Date de facture',status:'Statut',total:'Total',overdue:'En retard'},
 en: {title:'Financial administration',intro:'Record draft documents. Final approval and Peppol sending are not active yet.',new:'New draft',kind:'Document type',number:'Document number',net:'Net amount',tax:'VAT amount',notes:'Notes',save:'Save draft',empty:'No financial documents yet.',back:'Administration',error:'Document could not be saved.',currency:'Currency',review:'Submit for review',approve:'Approve',void:'Void',actionError:'Could not change status.',due:'Due date',party:'Customer or supplier',none:'No counterparty',issue:'Invoice date',status:'Status',total:'Total',overdue:'Overdue'},
 de: {title:'Finanzverwaltung',intro:'Erfasse Entwürfe. Endgültige Freigabe und Peppol-Versand sind noch nicht aktiv.',new:'Neuer Entwurf',kind:'Dokumenttyp',number:'Dokumentnummer',net:'Nettobetrag',tax:'MwSt.-Betrag',notes:'Notizen',save:'Entwurf speichern',empty:'Noch keine Finanzdokumente.',back:'Verwaltung',error:'Dokument konnte nicht gespeichert werden.',currency:'Währung',review:'Zur Prüfung',approve:'Genehmigen',void:'Stornieren',actionError:'Statusänderung fehlgeschlagen.',due:'Fälligkeitsdatum',party:'Kunde oder Lieferant',none:'Kein Kontakt',issue:'Rechnungsdatum',status:'Status',total:'Gesamt',overdue:'Überfällig'},
} as const

async function requireAdministration() {
 const current = await getCurrentUser()
 if (!current) redirect('/login')
 const supabase = await createClient()
 const { data, error } = await supabase.rpc('upt_my_portal_assignments')
 if (error && !current.isAdmin) redirect('/portals')
 if (!current.isAdmin && !canOpenPortal('administration',(data ?? []) as PortalAssignment[],{
   approved:current.approved,blocked:current.account_blocked===true,
 })) redirect('/portals')
 return supabase
}

async function createDraft(formData:FormData) {
 'use server'
 const supabase = (await requireAdministration()) as unknown as SupabaseClient
 const kind = String(formData.get('kind') ?? '')
 const allowed = ['sales_invoice','purchase_invoice','credit_note','expense','quote']
 if (!allowed.includes(kind)) return
 const net = Number(formData.get('net_amount'))
 const tax = Number(formData.get('tax_amount'))
 if (!Number.isFinite(net) || !Number.isFinite(tax) || net < 0 || tax < 0 || net > 999999999 || tax > 999999999) return
 const documentNumber = String(formData.get('document_number') ?? '').trim().slice(0,100)
 const notes = String(formData.get('notes') ?? '').trim().slice(0,2000)
 const dueDate = String(formData.get('due_date') ?? '')
 const counterpartyId = String(formData.get('counterparty_id') ?? '')
 if (dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(Date.parse(dueDate)))) return
 if (counterpartyId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(counterpartyId)) return
 const issueDate = String(formData.get('issue_date') ?? '')
 if (issueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate) || Number.isNaN(Date.parse(issueDate)))) return
 const { error } = await supabase.from('admin_financial_documents').insert({
   counterparty_id:counterpartyId || null, issue_date:issueDate || null, due_date:dueDate || null,
   kind, document_number:documentNumber || null, net_amount:net, tax_amount:tax,
   notes:notes || null, status:'draft', currency:'EUR',
 })
 if (error) redirect('/portals/administration/finance?error=1')
 revalidatePath('/portals/administration/finance')
 redirect('/portals/administration/finance')
}

async function changeDocumentStatus(formData:FormData) {
 'use server'
 const current = await getCurrentUser()
 if (!current) redirect('/login')
 const db = (await requireAdministration()) as unknown as SupabaseClient
 const id = String(formData.get('id') ?? '')
 const transition = String(formData.get('transition') ?? '')
 if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return
 const rules:Record<string,{from:string,to:string,admin:boolean}> = {
  review:{from:'draft',to:'review',admin:false},
  approve:{from:'review',to:'approved',admin:true},
  void:{from:'approved',to:'void',admin:true},
 }
 const rule=rules[transition]
 if (!rule || (rule.admin && !current.isAdmin)) redirect('/portals/administration/finance?error=1')
 const payload:Record<string,string> = {status:rule.to}
 if (transition==='approve') {
  payload.approved_by=current.id
  payload.approved_at=new Date().toISOString()
 }
 const {data,error}=await db.from('admin_financial_documents').update(payload).eq('id',id).eq('status',rule.from).select('id').maybeSingle()
 if (error || !data) redirect('/portals/administration/finance?error=1')
 revalidatePath('/portals/administration/finance')
 revalidatePath('/portals/administration')
 redirect('/portals/administration/finance')
}

export const dynamic = 'force-dynamic'
export default async function FinancePage({searchParams}:{searchParams:Promise<{error?:string}>}) {
 const supabase = (await requireAdministration()) as unknown as SupabaseClient
 const current = await getCurrentUser()
 const locale = await requestUiLocale()
 const t = copy[locale]
 const params = await searchParams
 const {data:counterparties} = await supabase.from('admin_counterparties').select('id,name').order('name').limit(200)
 const {data:documents,error} = await supabase.from('admin_financial_documents')
   .select('id,kind,document_number,net_amount,tax_amount,gross_amount,currency,status,due_date,created_at,counterparty_id')
   .order('created_at',{ascending:false}).limit(100)
 return <main className="mx-auto max-w-5xl space-y-6 p-4 pb-28 md:p-8">
  <Link className="text-violet-400" href="/portals/administration">← {t.back}</Link>
  <header><h1 className="text-3xl font-black">{t.title}</h1><p className="mt-2 text-muted-foreground">{t.intro}</p></header>
  <section className="rounded-2xl border bg-card p-5">
   <h2 className="mb-4 text-lg font-bold">{t.new}</h2>
   <form action={createDraft} className="grid gap-3 sm:grid-cols-2">
    <label className="space-y-1 text-sm">{t.kind}<select name="kind" required className="block w-full rounded-lg border bg-background p-3"><option value="purchase_invoice">Purchase invoice</option><option value="sales_invoice">Sales invoice</option><option value="expense">Expense</option><option value="credit_note">Credit note</option><option value="quote">Quote</option></select></label>
    <label className="space-y-1 text-sm">{t.number}<input name="document_number" maxLength={100} className="block w-full rounded-lg border bg-background p-3"/></label>
    <label className="space-y-1 text-sm">{t.party}<select name="counterparty_id" className="block w-full rounded-lg border bg-background p-3"><option value="">{t.none}</option>{(counterparties ?? []).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label className="space-y-1 text-sm">{t.issue}<input type="date" name="issue_date" className="block w-full rounded-lg border bg-background p-3"/></label>
    <label className="space-y-1 text-sm">{t.due}<input type="date" name="due_date" className="block w-full rounded-lg border bg-background p-3"/></label>
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
     <div><p className="font-semibold">{d.document_number || d.kind}</p><p className="text-xs text-muted-foreground">{d.kind} · {d.status}{d.due_date ? ` · ${t.due}: ${d.due_date}` : ''}{d.due_date && d.due_date < new Date().toISOString().slice(0,10) && !['paid','void'].includes(d.status) ? ` · ${t.overdue}` : ''}</p></div>
     <strong>{new Intl.NumberFormat(locale==='nl'?'nl-BE':locale==='fr'?'fr-BE':locale==='de'?'de-BE':'en-BE',{style:'currency',currency:d.currency}).format(Number(d.gross_amount))}</strong>
     <form action={changeDocumentStatus} className="flex flex-wrap gap-2">
      <input type="hidden" name="id" value={d.id}/>
      {d.status==='draft' && <button name="transition" value="review" className="rounded-lg border px-3 py-2 text-sm">{t.review}</button>}
      {current?.isAdmin && d.status==='review' && <button name="transition" value="approve" className="rounded-lg border px-3 py-2 text-sm">{t.approve}</button>}
      {current?.isAdmin && d.status==='approved' && <button name="transition" value="void" className="rounded-lg border px-3 py-2 text-sm">{t.void}</button>}
     </form>
    </article>)}</div>}
  </section>
 </main>
}
