import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/crew-server'
import { canOpenPortal, type PortalAssignment } from '@/lib/portal-access'
import { requestUiLocale } from '@/lib/server-locale'

const translations = {
 nl:{title:'Klanten en leveranciers',new:'Nieuwe relatie',name:'Naam',kind:'Type',customer:'Klant',supplier:'Leverancier',both:'Beide',vat:'Btw-nummer',enterprise:'Ondernemingsnummer',email:'E-mail',save:'Opslaan',edit:'Relatie bewerken',update:'Wijzigingen opslaan',empty:'Nog geen relaties.',error:'Opslaan of laden mislukt.',back:'Administratie'},
 fr:{title:'Clients et fournisseurs',new:'Nouveau contact',name:'Nom',kind:'Type',customer:'Client',supplier:'Fournisseur',both:'Les deux',vat:'Numéro TVA',enterprise:'Numéro d’entreprise',email:'E-mail',save:'Enregistrer',edit:'Modifier le contact',update:'Enregistrer les modifications',empty:'Aucun contact.',error:'Échec de l’enregistrement ou du chargement.',back:'Administration'},
 en:{title:'Customers and suppliers',new:'New counterparty',name:'Name',kind:'Type',customer:'Customer',supplier:'Supplier',both:'Both',vat:'VAT number',enterprise:'Enterprise number',email:'Email',save:'Save',edit:'Edit counterparty',update:'Save changes',empty:'No counterparties yet.',error:'Could not save or load.',back:'Administration'},
 de:{title:'Kunden und Lieferanten',new:'Neuer Kontakt',name:'Name',kind:'Typ',customer:'Kunde',supplier:'Lieferant',both:'Beides',vat:'USt-IdNr.',enterprise:'Unternehmensnummer',email:'E-Mail',save:'Speichern',edit:'Kontakt bearbeiten',update:'Änderungen speichern',empty:'Noch keine Kontakte.',error:'Speichern oder Laden fehlgeschlagen.',back:'Verwaltung'},
} as const

async function authorizedClient() {
 const user = await getCurrentUser()
 if (!user) redirect('/login')
 if ((!user.approved || Boolean(user.account_blocked)) && !user.isOwner) redirect('/portals')
 const db = await createClient()
 if (!user.realIsAdmin && !user.isOwner) {
  const {data,error} = await db.rpc('upt_my_portal_assignments')
  if (error || !canOpenPortal('administration',(data ?? []) as PortalAssignment[],{approved:user.approved,blocked:user.account_blocked===true})) redirect('/portals')
 }
 return db
}

async function addCounterparty(formData:FormData) {
 'use server'
 const db = await authorizedClient()
 const name = String(formData.get('name') ?? '').trim()
 const kind = String(formData.get('kind') ?? '')
 const vat_number = String(formData.get('vat_number') ?? '').trim()
 const enterprise_number = String(formData.get('enterprise_number') ?? '').trim()
 const email = String(formData.get('email') ?? '').trim()
 if (!name || name.length>200 || vat_number.length>40 || enterprise_number.length>40 || email.length>254 || !['customer','supplier','both'].includes(kind) || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) redirect('/portals/administration/counterparties?error=1')
 const {error} = await db.from('admin_counterparties').insert({name,kind,vat_number:vat_number||null,enterprise_number:enterprise_number||null,email:email||null})
 if (error) redirect('/portals/administration/counterparties?error=1')
 revalidatePath('/portals/administration/counterparties')
 redirect('/portals/administration/counterparties')
}


async function updateCounterparty(formData:FormData) {
 'use server'
 const db = await authorizedClient()
 const id = String(formData.get('id') ?? '')
 const name = String(formData.get('name') ?? '').trim()
 const kind = String(formData.get('kind') ?? '')
 const vat_number = String(formData.get('vat_number') ?? '').trim()
 const enterprise_number = String(formData.get('enterprise_number') ?? '').trim()
 const email = String(formData.get('email') ?? '').trim()
 if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || !name || name.length>200 || !['customer','supplier','both'].includes(kind) || vat_number.length>40 || enterprise_number.length>40 || email.length>254 || (email && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email))) redirect('/portals/administration/counterparties?error=1')
 const {data,error} = await db.from('admin_counterparties').update({name,kind,vat_number:vat_number||null,enterprise_number:enterprise_number||null,email:email||null}).eq('id',id).select('id').maybeSingle()
 if (error || !data) redirect('/portals/administration/counterparties?error=1')
 revalidatePath('/portals/administration/counterparties')
 redirect('/portals/administration/counterparties')
}

export const dynamic = 'force-dynamic'
export default async function CounterpartiesPage({searchParams}:{searchParams:Promise<{error?:string;edit?:string}>}) {
 const db = await authorizedClient()
 const locale = await requestUiLocale()
 const t = translations[locale]
 const params = await searchParams
 const {data,error} = await db.from('admin_counterparties').select('id,name,kind,vat_number,enterprise_number,email').order('name').limit(200)
 const selectedId=typeof params.edit==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.edit)?params.edit:null
 const selected=selectedId?await db.from('admin_counterparties').select('id,name,kind,vat_number,enterprise_number,email').eq('id',selectedId).maybeSingle():null
 return <main className="mx-auto max-w-5xl space-y-6 p-4 pb-28 md:p-8">
  <Link href="/portals/administration" className="text-violet-400">← {t.back}</Link>
  <h1 className="text-3xl font-bold">{t.title}</h1>
  <section className="rounded-2xl border bg-card p-5">
   <h2 className="mb-4 font-semibold">{t.new}</h2>
   <form action={addCounterparty} className="grid gap-3 sm:grid-cols-2">
    <label className="text-sm">{t.name}<input required name="name" maxLength={200} className="mt-1 block w-full rounded-lg border bg-background p-3"/></label>
    <label className="text-sm">{t.kind}<select name="kind" className="mt-1 block w-full rounded-lg border bg-background p-3"><option value="customer">{t.customer}</option><option value="supplier">{t.supplier}</option><option value="both">{t.both}</option></select></label>
    <label className="text-sm">{t.vat}<input name="vat_number" maxLength={40} className="mt-1 block w-full rounded-lg border bg-background p-3"/></label>
    <label className="text-sm">{t.enterprise}<input name="enterprise_number" maxLength={40} className="mt-1 block w-full rounded-lg border bg-background p-3"/></label>
    <label className="text-sm sm:col-span-2">{t.email}<input type="email" name="email" maxLength={254} className="mt-1 block w-full rounded-lg border bg-background p-3"/></label>
    <button className="rounded-lg bg-violet-600 p-3 font-semibold text-white">{t.save}</button>
   </form>
   {params.error==='1' && <p role="alert" className="mt-3 text-red-400">{t.error}</p>}
  </section>
  {selected?.data&&<section className="rounded-2xl border bg-card p-5">
   <h2 className="mb-4 font-semibold">{t.edit}: {selected.data.name}</h2>
   <form action={updateCounterparty} className="grid gap-3 sm:grid-cols-2">
    <input type="hidden" name="id" value={selected.data.id}/>
    <label className="text-sm">{t.name}<input required name="name" maxLength={200} defaultValue={selected.data.name} className="mt-1 block w-full rounded-lg border bg-background p-3"/></label>
    <label className="text-sm">{t.kind}<select name="kind" defaultValue={selected.data.kind} className="mt-1 block w-full rounded-lg border bg-background p-3"><option value="customer">{t.customer}</option><option value="supplier">{t.supplier}</option><option value="both">{t.both}</option></select></label>
    <label className="text-sm">{t.vat}<input name="vat_number" maxLength={40} defaultValue={selected.data.vat_number??''} className="mt-1 block w-full rounded-lg border bg-background p-3"/></label>
    <label className="text-sm">{t.enterprise}<input name="enterprise_number" maxLength={40} defaultValue={selected.data.enterprise_number??''} className="mt-1 block w-full rounded-lg border bg-background p-3"/></label>
    <label className="text-sm sm:col-span-2">{t.email}<input type="email" name="email" maxLength={254} defaultValue={selected.data.email??''} className="mt-1 block w-full rounded-lg border bg-background p-3"/></label>
    <button className="rounded-lg bg-violet-600 p-3 font-semibold text-white">{t.update}</button>
   </form>
  </section>}
  <section className="rounded-2xl border bg-card p-5">
   {error ? <p role="alert">{t.error}</p> : !data?.length ? <p className="text-muted-foreground">{t.empty}</p> : <div className="space-y-3">{data.map(item=><article key={item.id} className="border-b pb-3"><div className="flex items-center justify-between gap-3"><p className="font-semibold">{item.name}</p><Link href={`/portals/administration/counterparties?edit=${encodeURIComponent(item.id)}`} className="rounded-lg border px-3 py-2 text-sm text-violet-400">{t.edit}</Link></div><p className="text-sm text-muted-foreground">{item.kind} · {[item.vat_number,item.enterprise_number,item.email].filter(Boolean).join(' · ')}</p></article>)}</div>}
  </section>
 </main>
}
