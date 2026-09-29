import Image from 'next/image'
import { getCurrentUser } from '@/lib/actions/auth'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/crew-server'
import { approvePersonnelAccount } from '@/lib/actions/uptilldawn'
import { deletePersonnel } from '@/lib/actions/personnel'
import { nlRole } from '@/lib/ui-nl'

export const dynamic='force-dynamic'

export default async function Page({searchParams}:{searchParams?:Promise<{feedback?:string}>}){
  const params=searchParams?await searchParams:{}
  const current=await getCurrentUser()
  if(!current?.isAdmin)redirect('/')
  const s=await createClient()
  const {data,error}=await s.rpc('upt_admin_personnel_details_v2')
  const pending=(data||[]).filter(person=>!person.approved)

  const photos=new Map<string,string>()
  await Promise.all(pending.filter(person=>person.profile_photo_url).map(async person=>{
    const {data:signed}=await s.storage.from('profile-photos').createSignedUrl(person.profile_photo_url!,300)
    if(signed?.signedUrl)photos.set(person.id,signed.signedUrl)
  }))

  return <main className="mx-auto max-w-5xl space-y-5 p-4 pb-28 md:p-8">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-black uppercase tracking-[.2em] text-violet-400">TOEGANGSCONTROLE</p>
        <h1 className="text-3xl font-black">Goedkeuringen</h1>
        <p className="mt-1 text-sm text-muted-foreground">Hier staan alleen nieuwe accounts die nog toegang moeten krijgen. Bestaand personeel beheer je via Personeel.</p>
      </div>
      <span className="rounded-full border px-3 py-2 text-sm font-bold">{pending.length} in afwachting</span>
    </header>

    {params.feedback==='approved'&&<p role="status" className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 font-semibold text-emerald-600">Account goedgekeurd. De gebruiker heeft nu toegang en ontvangt hiervan een melding.</p>}
    {error&&<p className="rounded-xl border border-red-500/40 p-4">Goedkeuringen konden niet worden geladen.</p>}
    {!error&&!pending.length&&<p className="rounded-2xl border p-5 text-muted-foreground">Geen nieuwe accounts wachten op goedkeuring.</p>}

    <div className="grid gap-3">{pending.map(person=><article key={person.id} className="rounded-2xl border p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        {photos.get(person.id)&&<a href={photos.get(person.id)} target="_blank" rel="noreferrer" className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border">
          <Image src={photos.get(person.id)!} alt="" fill sizes="80px" unoptimized className="object-cover"/>
        </a>}
        <div className="min-w-0 flex-1">
          <h2 className="font-black">{person.full_name||'Naam ontbreekt'}</h2>
          <p className="break-all text-sm text-muted-foreground">{person.email||'Geen e-mail'}</p>
          <p className="text-sm text-muted-foreground">Aangevraagde rol: {nlRole(person.role)}</p>
          <details className="mt-3 rounded-xl border p-3">
            <summary className="cursor-pointer font-semibold">Registratiegegevens bekijken</summary>
            <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
              <div><dt className="text-muted-foreground">Telefoon</dt><dd>{person.phone_number||'—'}</dd></div>
              <div><dt className="text-muted-foreground">Geboortedatum</dt><dd>{person.date_of_birth||'—'}</dd></div>
              <div className="md:col-span-2"><dt className="text-muted-foreground">Adres</dt><dd>{person.home_address||'—'}</dd></div>
            </dl>
          </details>
        </div>
        <div className="grid gap-2 md:min-w-[300px]">
          <form action={approvePersonnelAccount} className="grid gap-2 rounded-xl border p-3">
            <input type="hidden" name="user_id" value={person.id}/>
            <label className="grid gap-1 text-sm">Rol bij goedkeuring
              <select name="role" defaultValue={person.role} className="rounded-lg border bg-background p-2">
                <option value="staff">Personeel</option>
                <option value="responsible_lead">Verantwoordelijke</option>
                <option value="admin">Beheerder</option>
              </select>
            </label>
            <button className="rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white">GOEDKEUREN</button>
          </form>
          <details className="rounded-xl border border-red-500/30 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-red-500">Aanvraag afwijzen</summary>
            <p className="my-2 text-xs text-muted-foreground">Dit verwijdert het nog niet goedgekeurde account. Gebruik dit alleen wanneer de registratie niet mag worden toegelaten.</p>
            <form action={deletePersonnel}>
              <input type="hidden" name="user_id" value={person.id}/>
              <button className="rounded-lg border border-red-500/60 px-4 py-2 text-sm font-semibold text-red-500">AFWIJZEN & VERWIJDEREN</button>
            </form>
          </details>
        </div>
      </div>
    </article>)}</div>
  </main>
}
