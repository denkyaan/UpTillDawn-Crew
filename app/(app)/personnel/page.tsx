import Image from 'next/image'
import { getCurrentUser } from '@/lib/actions/auth'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/crew-server'
import { approvePersonnelAccount } from '@/lib/actions/uptilldawn'
import { nlRole } from '@/lib/ui-nl'
import { PendingSubmitButton } from '@/components/ui/pending-submit-button'
import { SandboxRoleModule } from '@/components/training/sandbox-role-module'

export const dynamic = 'force-dynamic'

export default async function Page({searchParams}:{searchParams?:Promise<{feedback?:string;user?:string;focus?:string}>}) {
  const params=searchParams?await searchParams:{}
  const current=await getCurrentUser()
  if(!current?.isAdmin)redirect('/')
  if(params.tour==='1')return <SandboxRoleModule role="admin" module="personnel"/>
  const s=await createClient()
  const {data,error}=await s.rpc('upt_admin_personnel_details_v2')
  const pending=(data||[]).filter(person=>!person.approved).sort((a,b)=>Number(b.id===params.user)-Number(a.id===params.user))

  const photos=new Map<string,string>()
  await Promise.all(pending.filter(person=>person.profile_photo_url).map(async person=>{
    const {data:signed}=await s.storage.from('profile-photos').createSignedUrl(person.profile_photo_url!,300)
    if(signed?.signedUrl)photos.set(person.id,signed.signedUrl)
  }))

  return <main className="mx-auto max-w-6xl space-y-5 p-4 pb-28 md:p-8">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-black uppercase tracking-[.2em] text-violet-400">TOEGANG</p>
        <h1 className="text-3xl font-black">Goedkeuringen</h1>
        <p className="mt-1 text-sm text-muted-foreground">Behandel uitsluitend nieuwe accountaanvragen. Bestaand personeel beheer je onder Personeel.</p>
      </div>
      <span className="rounded-full border px-3 py-2 text-sm font-black">{pending.length} openstaand</span>
    </header>

    {params.feedback==='approved'&&<p role="status" className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 font-semibold text-emerald-600">Account goedgekeurd. De gebruiker heeft nu toegang en ontvangt hiervan een melding.</p>}
    {error&&<p className="rounded-xl border border-red-500/40 p-4 text-red-500">Accountaanvragen konden niet worden geladen.</p>}
    {!error&&!pending.length&&<p className="rounded-2xl border p-5 text-muted-foreground">Er zijn geen openstaande accountaanvragen.</p>}

    <div className="grid gap-3">{pending.map(person=>{const focused=person.id===params.user;return <article id={focused?'approval-focus':undefined} key={person.id} className={'rounded-2xl border p-4 '+(focused?'border-violet-500/70 ring-1 ring-violet-500/20':'')}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border bg-muted text-xl font-black">
          {photos.get(person.id)
            ? <Image src={photos.get(person.id)!} alt="" fill sizes="80px" unoptimized className="object-cover"/>
            : (person.full_name||'?').trim().charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-black">{person.full_name||'Naam ontbreekt'}</h2>
          <p className="break-all text-sm text-muted-foreground">{person.email||'Geen e-mail'}</p>
          <p className="mt-1 text-sm text-muted-foreground">Voorgestelde rol: {nlRole(person.role)}</p>
          <details className="mt-3 rounded-xl border p-3">
            <summary className="cursor-pointer font-semibold">Registratiegegevens controleren</summary>
            <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
              <div><dt className="text-muted-foreground">Telefoon</dt><dd>{person.phone_number||'—'}</dd></div>
              <div><dt className="text-muted-foreground">Geboortedatum</dt><dd>{person.date_of_birth||'—'}</dd></div>
              <div className="md:col-span-2"><dt className="text-muted-foreground">Adres</dt><dd>{person.home_address||'—'}</dd></div>
            </dl>
          </details>
        </div>
        <form action={approvePersonnelAccount} className="grid min-w-0 gap-2 md:min-w-[290px]">
          <input type="hidden" name="user_id" value={person.id}/>
          <label className="grid gap-1 text-sm font-semibold">Initiële rol
            <select name="role" defaultValue={person.role} className="rounded-xl border bg-background p-3">
              <option value="staff">Personeel</option>
              <option value="responsible_lead">Verantwoordelijke</option>
              <option value="admin">Beheerder</option>
            </select>
          </label>
          <p className="text-xs text-muted-foreground">Na goedkeuring wordt toegang onmiddellijk actief en ontvangt de gebruiker een melding.</p>
          <PendingSubmitButton pendingLabel="GOEDKEUREN…" className="rounded-xl bg-emerald-700 p-3 font-black text-white">ACCOUNT GOEDKEUREN</PendingSubmitButton>
        </form>
      </div>
    </article>})}</div>
  </main>
}
