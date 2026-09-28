import Image from 'next/image'
import { getCurrentUser } from '@/lib/actions/auth'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/crew-server'
import { approvePersonnelAccount,setAccountStatus } from '@/lib/actions/uptilldawn'
import { deletePersonnel,setPersonnelBlock } from '@/lib/actions/personnel'
import { nlRole, nlStatus } from '@/lib/ui-nl'

export const dynamic = 'force-dynamic'

export default async function Page({searchParams}:{searchParams?:Promise<{feedback?:string}>}) {
  const params=searchParams?await searchParams:{}
  const current=await getCurrentUser()
  if (!current?.isAdmin) redirect('/')
  const s = await createClient()
  const { data, error } = await s.rpc('upt_admin_personnel_details_v2')

  const photos = new Map<string,string>()
  await Promise.all((data || []).filter(p => p.profile_photo_url).map(async p => {
    const { data: signed } = await s.storage.from('profile-photos').createSignedUrl(p.profile_photo_url!, 300)
    if (signed?.signedUrl) photos.set(p.id, signed.signedUrl)
  }))

  return <main className="p-4 pb-28 md:p-8">
    <div className="mb-5">
      <h1 className="text-3xl font-black">Personeel & goedkeuringen</h1>
      <p className="mt-1 text-sm text-muted-foreground">Keur accounts goed, wijzig rollen, blokkeer toegang tijdelijk of verwijder een account definitief.</p>
    </div>
    {params.feedback==='approved'&&<p role="status" className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 font-semibold text-emerald-600">Account goedgekeurd. De gebruiker heeft nu toegang en ontvangt hiervan een melding.</p>}
    {error && <p>Personeelsgegevens konden niet worden geladen.</p>}
    <div className="grid gap-3">{data?.map(p => {
      const isSelf=p.id===current.id
      return <div key={p.id} className="rounded-2xl border p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          {photos.get(p.id) && <a href={photos.get(p.id)} target="_blank" rel="noreferrer" className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border">
            <Image src={photos.get(p.id)!} alt="" fill sizes="80px" unoptimized className="object-cover"/>
          </a>}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <b>{p.full_name || 'Naam ontbreekt'}</b>
              {p.account_blocked&&<span className="rounded-full border border-red-500/50 px-2 py-1 text-xs font-black text-red-500">GEBLOKKEERD</span>}
            </div>
            <p className="break-all text-sm text-muted-foreground">{p.email || 'Geen e-mail'}</p>
            <p className="text-sm text-muted-foreground">{nlRole(p.role)} · {p.account_blocked?'Geblokkeerd':nlStatus(p.approved ? 'approved' : 'pending')}</p>
            {p.account_blocked&&<div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/5 p-2 text-xs text-muted-foreground">
              <b className="text-red-500">Toegang geblokkeerd</b>
              {p.blocked_reason&&<p className="mt-1">Reden: {p.blocked_reason}</p>}
              {p.blocked_at&&<p className="mt-1">Sinds {new Date(p.blocked_at).toLocaleString('nl-BE')}</p>}
            </div>}
            <details className="mt-3 rounded-xl border p-3">
              <summary className="cursor-pointer font-semibold">Privé personeelsgegevens</summary>
              <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                <div><dt className="text-muted-foreground">Telefoon</dt><dd>{p.phone_number || '—'}</dd></div>
                <div><dt className="text-muted-foreground">Geboortedatum</dt><dd>{p.date_of_birth || '—'}</dd></div>
                <div className="md:col-span-2"><dt className="text-muted-foreground">Adres</dt><dd>{p.home_address || '—'}</dd></div>
                <div><dt className="text-muted-foreground">Rijksregisternummer</dt><dd>{p.national_register_number || '—'}</dd></div>
                <div><dt className="text-muted-foreground">IBAN</dt><dd>{p.iban || '—'}</dd></div>
              </dl>
            </details>
          </div>
          <div className="flex min-w-0 flex-col gap-3 md:min-w-[310px]">
            <fieldset disabled={p.account_blocked} className="disabled:opacity-50">
              {!p.approved
                ? <form action={approvePersonnelAccount} className="flex flex-wrap gap-2">
                    <input type="hidden" name="user_id" value={p.id}/>
                    <select name="role" defaultValue={p.role} className="rounded-lg border bg-background p-2"><option value="staff">Personeel</option><option value="responsible_lead">Verantwoordelijke</option><option value="admin">Beheerder</option></select>
                    <button className="rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white">GOEDKEUREN</button>
                  </form>
                : <form action={setAccountStatus} className="flex flex-wrap gap-2">
                    <input type="hidden" name="user_id" value={p.id}/>
                    <input type="hidden" name="status" value="approved"/>
                    <select name="role" defaultValue={p.role} className="rounded-lg border bg-background p-2"><option value="staff">Personeel</option><option value="responsible_lead">Verantwoordelijke</option><option value="admin">Beheerder</option></select>
                    <button className="rounded-lg bg-violet-600 px-4 py-2">ROL OPSLAAN</button>
                  </form>}
            </fieldset>

            {!isSelf&&<div className="space-y-2 rounded-xl border p-3">
              {p.account_blocked
                ? <form action={setPersonnelBlock}>
                    <input type="hidden" name="user_id" value={p.id}/>
                    <input type="hidden" name="blocked" value="false"/>
                    <button className="rounded-lg border border-emerald-500/50 px-4 py-2 font-semibold text-emerald-600">DEBLOKKEREN</button>
                  </form>
                : <form action={setPersonnelBlock} className="grid gap-2">
                    <input type="hidden" name="user_id" value={p.id}/>
                    <input type="hidden" name="blocked" value="true"/>
                    <input name="reason" maxLength={1000} placeholder="Reden blokkering (optioneel)" className="rounded-lg border bg-background p-2"/>
                    <button className="rounded-lg border border-amber-500/60 px-4 py-2 font-semibold text-amber-600">BLOKKEREN</button>
                  </form>}

              <form action={deletePersonnel}>
                <input type="hidden" name="user_id" value={p.id}/>
                <button className="rounded-lg border border-red-500/60 px-4 py-2 font-semibold text-red-500">DEFINITIEF VERWIJDEREN</button>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">Verwijdert het account en persoonlijke toewijzingen definitief. Operationele bewijsbestanden blijven voor auditdoeleinden bewaard.</p>
              </form>
            </div>}

            {isSelf&&<p className="rounded-xl border p-3 text-xs text-muted-foreground">Je eigen beheeraccount kan hier niet worden geblokkeerd of verwijderd.</p>}
          </div>
        </div>
      </div>
    })}</div>
  </main>
}
