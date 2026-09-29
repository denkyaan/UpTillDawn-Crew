import Image from 'next/image'
import { createClient } from '@/lib/supabase/crew-server'
import { getCurrentUser } from '@/lib/actions/auth'
import { redirect } from 'next/navigation'
import { setAccountStatus } from '@/lib/actions/uptilldawn'
import { deletePersonnel,setPersonnelBlock } from '@/lib/actions/personnel'
import { nlRole } from '@/lib/ui-nl'

export const dynamic='force-dynamic'

export default async function Page(){
  const current=await getCurrentUser()
  if(!current)redirect('/login')
  const s=await createClient()

  if(current.isAdmin){
    const {data,error}=await s.rpc('upt_admin_personnel_details_v2')
    const crew=(data||[]).filter(person=>person.approved)
    const photos=new Map<string,string>()
    await Promise.all(crew.filter(person=>person.profile_photo_url).map(async person=>{
      const {data:signed}=await s.storage.from('profile-photos').createSignedUrl(person.profile_photo_url!,300)
      if(signed?.signedUrl)photos.set(person.id,signed.signedUrl)
    }))
    return <main className="mx-auto max-w-6xl space-y-5 p-4 pb-28 md:p-8">
      <header>
        <p className="text-xs font-black uppercase tracking-[.2em] text-violet-400">TEAMBEHEER</p>
        <h1 className="text-3xl font-black">Personeel</h1>
        <p className="mt-1 text-sm text-muted-foreground">Beheer bestaande goedgekeurde crew: rollen, toegang, contactgegevens en accountstatus. Nieuwe accounts staan uitsluitend onder Goedkeuringen.</p>
      </header>
      {error&&<p className="rounded-xl border border-red-500/40 p-4">Personeelsgegevens konden niet worden geladen.</p>}
      <div className="grid gap-3">{crew.map(person=>{
        const isSelf=person.id===current.id
        return <article key={person.id} className="rounded-2xl border p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-start">
            <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border bg-muted text-xl font-black">
              {photos.get(person.id)?<Image src={photos.get(person.id)!} alt="" width={80} height={80} unoptimized className="h-full w-full object-cover"/>:(person.full_name||'?').trim().charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><h2 className="font-black">{person.full_name||'Naam ontbreekt'}</h2>{person.account_blocked&&<span className="rounded-full border border-red-500/50 px-2 py-1 text-xs font-black text-red-500">GEBLOKKEERD</span>}</div>
              <p className="break-all text-sm text-muted-foreground">{person.email||'Geen e-mail'}</p>
              <p className="text-sm text-muted-foreground">{nlRole(person.role)}{person.phone_number?' · '+person.phone_number:''}</p>
              <details className="mt-3 rounded-xl border p-3">
                <summary className="cursor-pointer font-semibold">Personeelsgegevens</summary>
                <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                  <div><dt className="text-muted-foreground">Telefoon</dt><dd>{person.phone_number||'—'}</dd></div>
                  <div><dt className="text-muted-foreground">Geboortedatum</dt><dd>{person.date_of_birth||'—'}</dd></div>
                  <div className="md:col-span-2"><dt className="text-muted-foreground">Adres</dt><dd>{person.home_address||'—'}</dd></div>
                  <div><dt className="text-muted-foreground">Rijksregisternummer</dt><dd>{person.national_register_number||'—'}</dd></div>
                  <div><dt className="text-muted-foreground">IBAN</dt><dd>{person.iban||'—'}</dd></div>
                </dl>
              </details>
            </div>
            <div className="grid gap-2 md:min-w-[320px]">
              <form action={setAccountStatus} className="grid gap-2 rounded-xl border p-3">
                <input type="hidden" name="user_id" value={person.id}/>
                <input type="hidden" name="status" value="approved"/>
                <label className="grid gap-1 text-sm">Rol
                  <select name="role" defaultValue={person.role} className="rounded-lg border bg-background p-2">
                    <option value="staff">Personeel</option><option value="responsible_lead">Verantwoordelijke</option><option value="admin">Beheerder</option>
                  </select>
                </label>
                <button className="rounded-lg bg-violet-600 px-4 py-2 font-bold text-white">ROL OPSLAAN</button>
              </form>
              {!isSelf&&<div className="space-y-2 rounded-xl border p-3">
                {person.account_blocked
                  ? <form action={setPersonnelBlock}><input type="hidden" name="user_id" value={person.id}/><input type="hidden" name="blocked" value="false"/><button className="rounded-lg border border-emerald-500/50 px-4 py-2 font-semibold text-emerald-600">DEBLOKKEREN</button></form>
                  : <form action={setPersonnelBlock} className="grid gap-2"><input type="hidden" name="user_id" value={person.id}/><input type="hidden" name="blocked" value="true"/><input name="reason" maxLength={1000} placeholder="Reden blokkering (optioneel)" className="rounded-lg border bg-background p-2"/><button className="rounded-lg border border-amber-500/60 px-4 py-2 font-semibold text-amber-600">BLOKKEREN</button></form>}
                <details className="rounded-lg border border-red-500/30 p-2"><summary className="cursor-pointer text-sm font-semibold text-red-500">Definitief verwijderen</summary><p className="my-2 text-xs text-muted-foreground">Persoonlijke toewijzingen worden verwijderd; operationele bewijsgegevens blijven voor audit bewaard.</p><form action={deletePersonnel}><input type="hidden" name="user_id" value={person.id}/><button className="rounded-lg border border-red-500/60 px-4 py-2 text-sm font-semibold text-red-500">DEFINITIEF VERWIJDEREN</button></form></details>
              </div>}
              {isSelf&&<p className="rounded-xl border p-3 text-xs text-muted-foreground">Je eigen beheeraccount kan hier niet worden geblokkeerd of verwijderd.</p>}
            </div>
          </div>
        </article>
      })}</div>
    </main>
  }

  const {data:crew,error}=await s.rpc('upt_crew_directory')
  if(error)return <main className="mx-auto max-w-4xl p-4 md:p-8"><h1 className="text-3xl font-black">Personeel</h1><p className="mt-4">Personeelslijst kon niet worden geladen.</p></main>
  const photos=new Map<string,string>()
  await Promise.all((crew||[]).filter(member=>member.profile_photo_url).map(async member=>{
    const {data}=await s.storage.from('profile-photos').createSignedUrl(member.profile_photo_url!,300)
    if(data?.signedUrl)photos.set(member.id,data.signedUrl)
  }))
  return <main className="mx-auto max-w-4xl space-y-5 p-4 pb-28 md:p-8">
    <div><h1 className="text-3xl font-black">Personeel</h1><p className="text-sm text-muted-foreground">Alleen naam, profielfoto en telefoonnummer worden hier getoond.</p></div>
    <div className="grid gap-3 sm:grid-cols-2">{(crew||[]).map(member=><article key={member.id} className="flex items-center gap-4 rounded-2xl border p-4">
      <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border bg-muted text-xl font-black">{photos.get(member.id)?<Image src={photos.get(member.id)!} alt="" width={64} height={64} unoptimized className="h-full w-full object-cover"/>:(member.full_name||'?').trim().charAt(0).toUpperCase()}</div>
      <div className="min-w-0"><h2 className="truncate font-bold">{member.full_name||'Naam ontbreekt'}</h2>{member.phone_number?<a href={`tel:${member.phone_number}`} className="break-all text-sm underline">{member.phone_number}</a>:<p className="text-sm text-muted-foreground">Geen telefoonnummer</p>}</div>
    </article>)}</div>
  </main>
}
