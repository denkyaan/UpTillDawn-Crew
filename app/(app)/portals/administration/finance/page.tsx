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
 const { error } = await supabase.from('admin_financial_documents').insert({
   kind, document_number:documentNumber || null, net_amount:net, tax_amount:tax,
   notes:notes || null, status:'draft', currency:'EUR',
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
   .select('id,kind,document_number,net_amount,tax_amount,gross_amount,currency,status,created_at')
   .order('created_at',{ascending:false}).limit(100)
 const {data:lines}=await supabase.from('admin_financial_lines').select('id,document_id,description,quantity,unit_price,vat_rate').order('created_at',{ascending:true}).limit(500)
 const {data:attachments}=await (supabase as unknown as SupabaseClient).from('admin_financial_attachments').select('id,document_id,original_name,created_at').order('created_at',{ascending:false}).limit(200)
 const money = (amount:number) => new Intl.NumberFormat(locale==='nl'?'nl-BE':locale==='fr'?'fr-BE':locale==='de'?'de-BE':'en-BE',{style:'currency',currency:'EUR'}).format(amount)
 const paidTotal=(documents??[]).filter(d=>d.status==='paid').reduce((sum,d)=>sum+Number(d.gross_amount),0)
 const unpaidTotal=(documents??[]).filter(d=>['approved','issued','review'].includes(d.status)).reduce((sum,d)=>sum+Number(d.gross_amount),0)
 const draftCount=(documents??[]).filter(d=>d.status==='draft').length
 return <main className="mx-auto max-w-5xl space-y-6 p-4 pb-28 md:p-8">
  <Link className="text-violet-400" href="/portals/administration">← {t.back}</Link>
  <header><h1 className="text-3xl font-black">{t.title}</h1><p className="mt-2 text-muted-foreground">{t.intro}</p></header>
  <section className="rounded-2xl border bg-card p-5"><h2 className="mb-3 font-bold">{t.totals}</h2><div className="grid gap-3 sm:grid-cols-4">{[[t.count,String(documents?.length??0)],[t.draft,String(draftCount)],[t.outstanding,money(unpaidTotal)],[t.paid,money(paidTotal)]].map(([label,value])=><div key={label} className="rounded-lg border p-3"><p className="text-sm text-muted-foreground">{label}</p><strong>{value}</strong></div>)}</div></section>
  <section className="rounded-2xl border bg-card p-5">
   <h2 className="mb-4 text-lg font-bold">{t.new}</h2>
   <form action={createDraft} className="grid gap-3 sm:grid-cols-2">
    <label className="space-y-1 text-sm">{t.kind}<select name="kind" required className="block w-full rounded-lg border bg-background p-3">{kindValues.map((kind,index)=><option key={kind} value={kind}>{documentKinds[locale][index]}</option>)}</select></label>
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
     <div><p className="font-semibold">{d.document_number || translatedLabel(kindLabels[locale],d.kind)}</p><p className="text-xs text-muted-foreground">{translatedLabel(kindLabels[locale],d.kind)} · {translatedLabel(statusLabels[locale],d.status)}</p></div>
     <div className="w-full space-y-2">
      {(attachments??[]).filter(a=>a.document_id===d.id).map(a=><p key={a.id} className="text-xs text-muted-foreground">{uploadLabels[locale].attachments}: {a.original_name}</p>)}
      {(lines??[]).filter(line=>line.document_id===d.id).map(line=><p key={line.id} className="text-xs text-muted-foreground">{line.description} · {line.quantity} × {money(Number(line.unit_price))} · {line.vat_rate}%</p>)}
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
     {(transitions[d.status]??[]).filter(next=>isAdmin || next==='review').map(next=><form key={next} action={updateFinancialStatus}><input type="hidden" name="document_id" value={d.id}/><input type="hidden" name="status" value={next}/><button type="submit" className="rounded-lg border border-violet-500 px-3 py-2 text-xs font-semibold text-violet-400">{translatedLabel(actionLabels[locale],next)}</button></form>)}
     <strong>{new Intl.NumberFormat(locale==='nl'?'nl-BE':locale==='fr'?'fr-BE':locale==='de'?'de-BE':'en-BE',{style:'currency',currency:d.currency}).format(Number(d.gross_amount))}</strong></div>
    </article>)}</div>}
  </section>
 </main>
}
