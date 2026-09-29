import Image from 'next/image'
import { createClient } from '@/lib/supabase/crew-server'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/actions/auth'
import { deletePersonnel,setPersonnelBlock,setPersonnelRole } from '@/lib/actions/personnel'
import { nlRole } from '@/lib/ui-nl'

export const dynamic='force-dynamic'

export default async function Page(){
  const current=await getCurrentUser()
  if(!current)redirect('/login')
  const s=await createClient()
  const isAdmin=current.isAdmin===true

  if(!isAdmin){
    const {data:crew,error}=await s.rpc('upt_crew_directory')
    if(error)return <main className="mx-auto max-w-4xl p-4 md:p-8"><h1 className="text-3xl font-black">Personeel</h1><p className="mt-4">Personeelslijst kon niet worden geladen.</p></main>
    const photos=new Map<string,string>()
    await Promise.all((crew||[]).filter(member=>member.profile_photo_url).map(async member=>{
      const {data}=await s.storage.from('profile-photos').createSignedUrl(member.profile_photo_url!,300)
      if(data?.signedUrl)photos.set(member.id,data.signedUrl)
    }))
    return <main className="mx-auto max-w-4xl space-y-5 p-4 pb-28 md:p-8">
      <div><h1 className="text-3xl font-black">Personeel</h1><p className="text-sm text-muted-foreground">Contactgegevens van personeel waarmee je operationeel kunt samenwerken.</p></div>
      <div className="grid gap-3 sm:grid-cols-2">{(crew||[]).map(member=><article key={member.id} className="flex items-center gap-4 rounded-2xl border p-4">
        <div className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border bg-muted text-xl font-black">{photos.get(member.id)?<Image src={photos.get(member.id)!} alt="" fill sizes="64px" unoptimized className="object-cover"/>:(member.full_name||'?').trim().charAt(0).toUpperCase()}</div>
        <div className="min-w-0"><h2 className="truncate font-bold">{member.full_name||'Naam ontbreekt'}</h2>{member.phone_number?<a href={`tel:${member.phone_number}`} className="break-all text-sm underline">{member.phone_number}</a>:<p className="text-sm text-muted-foreground">Geen telefoonnummer</p>}</div>
      </article>)}</div>
    </main>
  }

  const [{data,error},{data:shiftRows},{data:taskRows}]=await Promise.all([
    s.rpc('upt_admin_personnel_details_v2'),
    s.from('shifts')
      .select('id,user_id,event_id,workplace_id,role_name,scheduled_start,scheduled_end,status,response_status,events(name),workplaces(name)')
      .neq('status','cancelled')
      .gte('scheduled_end',new Date().toISOString())
      .order('scheduled_start')
      .limit(1000),
    s.from('task_assignments').select('id,user_id,status').neq('status','COMPLETED').limit(2000),
  ])
  const crew=(data||[]).filter(person=>person.approved)
  const photos=new Map<string,string>()
  await Promise.all(crew.filter(person=>person.profile_photo_url).map(async person=>{
    const {data:signed}=await s.storage.from('profile-photos').createSignedUrl(person.profile_photo_url!,300)
    if(signed?.signedUrl)photos.set(person.id,signed.signedUrl)
  }))
  const shiftsByUser=new Map<string,typeof shiftRows>()
  for(const shift of shiftRows||[]){
    const currentRows=shiftsByUser.get(shift.user_id)||[]
    currentRows.push(shift)
    shiftsByUser.set(shift.user_id,currentRows)
  }
  const taskCount=new Map<string,number>()
  for(const task of taskRows||[])taskCount.set(task.user_id,(taskCount.get(task.user_id)||0)+1)

  return <main className="mx-auto max-w-7xl space-y-5 p-4 pb-28 md:p-8">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-black uppercase tracking-[.2em] text-violet-400">TEAMBEHEER</p>
        <h1 className="text-3xl font-black">Personeel</h1>
        <p className="mt-1 text-sm text-muted-foreground">Beheer goedgekeurde medewerkers, rollen, toegang, contactgegevens en komende planning. Nieuwe accounts staan onder Goedkeuringen.</p>
      </div>
      <span className="rounded-full border px-3 py-2 text-sm font-black">{crew.length} actief</span>
    </header>

    {error&&<p className="rounded-xl border border-red-500/40 p-4 text-red-500">Personeelsgegevens konden niet worden geladen.</p>}
    <div className="grid gap-4 xl:grid-cols-2">{crew.map(person=>{
      const own=person.id===current.id
      const future=shiftsByUser.get(person.id)||[]
      const next=future[0]
      return <article key={person.id} className="rounded-2xl border p-4">
        <div className="flex gap-4">
          <div className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border bg-muted text-xl font-black">{photos.get(person.id)?<Image src={photos.get(person.id)!} alt="" fill sizes="80px" unoptimized className="object-cover"/>:(person.full_name||'?').trim().charAt(0).toUpperCase()}</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-black">{person.full_name||'Naam ontbreekt'}</h2>{person.account_blocked&&<span className="rounded-full border border-red-500/50 px-2 py-1 text-xs font-black text-red-500">GEBLOKKEERD</span>}</div>
            <p className="break-all text-sm text-muted-foreground">{person.email||'Geen e-mail'}</p>
            <p className="text-sm text-muted-foreground">{nlRole(person.role)} · {future.length} komende shift(s) · {taskCount.get(person.id)||0} open taak/toewijzing(en)</p>
          </div>
        </div>

        {next&&<div className="mt-4 rounded-xl border p-3 text-sm">
          <b>Volgende shift</b>
          <p className="text-muted-foreground">{next.events?.name||'Evenement'} · {next.workplaces?.name||'Werkplek'} · {new Date(next.scheduled_start).toLocaleString('nl-BE')}</p>
        </div>}

        <details className="mt-4 rounded-xl border p-3">
          <summary className="cursor-pointer font-semibold">Personeelsgegevens & historiek</summary>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-muted-foreground">Telefoon</dt><dd>{person.phone_number||'—'}</dd></div>
            <div><dt className="text-muted-foreground">Geboortedatum</dt><dd>{person.date_of_birth||'—'}</dd></div>
            <div className="sm:col-span-2"><dt className="text-muted-foreground">Adres</dt><dd>{person.home_address||'—'}</dd></div>
            <div><dt className="text-muted-foreground">Rijksregisternummer</dt><dd>{person.national_register_number||'—'}</dd></div>
            <div><dt className="text-muted-foreground">IBAN</dt><dd>{person.iban||'—'}</dd></div>
          </dl>
          {future.length>0&&<div className="mt-4 space-y-2"><b className="text-sm">Komende shifts</b>{future.slice(0,5).map(shift=><div key={shift.id} className="rounded-lg border p-2 text-xs"><b>{shift.events?.name||'Evenement'} · {shift.workplaces?.name||'Werkplek'}</b><p className="text-muted-foreground">{new Date(shift.scheduled_start).toLocaleString('nl-BE')} → {new Date(shift.scheduled_end).toLocaleString('nl-BE')} · {shift.role_name}</p></div>)}</div>}
        </details>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <form action={setPersonnelRole} className="grid gap-2 rounded-xl border p-3">
            <input type="hidden" name="user_id" value={person.id}/>
            <label className="grid gap-1 text-sm font-semibold">Rol
              <select name="role" defaultValue={person.role} disabled={own} className="rounded-lg border bg-background p-2 disabled:opacity-50">
                <option value="staff">Personeel</option><option value="responsible_lead">Verantwoordelijke</option><option value="admin">Beheerder</option>
              </select>
            </label>
            <button disabled={own} className="rounded-lg bg-violet-600 px-4 py-2 font-bold text-white disabled:opacity-50">ROL OPSLAAN</button>
          </form>

          <div className="space-y-2 rounded-xl border p-3">
            {own?<p className="text-xs text-muted-foreground">Je eigen beheeraccount kan hier niet worden geblokkeerd, gedegradeerd of verwijderd.</p>:person.account_blocked
              ? <form action={setPersonnelBlock}><input type="hidden" name="user_id" value={person.id}/><input type="hidden" name="blocked" value="false"/><button className="rounded-lg border border-emerald-500/50 px-4 py-2 font-semibold text-emerald-600">DEBLOKKEREN</button></form>
              : <form action={setPersonnelBlock} className="grid gap-2"><input type="hidden" name="user_id" value={person.id}/><input type="hidden" name="blocked" value="true"/><input name="reason" maxLength={1000} placeholder="Reden blokkering (optioneel)" className="rounded-lg border bg-background p-2"/><button className="rounded-lg border border-amber-500/60 px-4 py-2 font-semibold text-amber-600">BLOKKEREN</button></form>}
            {!own&&<form action={deletePersonnel}><input type="hidden" name="user_id" value={person.id}/><button className="rounded-lg border border-red-500/60 px-4 py-2 font-semibold text-red-500">DEFINITIEF VERWIJDEREN</button><p className="mt-1 text-xs text-muted-foreground">Alleen gebruiken wanneer het account echt moet verdwijnen. Operationele auditgegevens blijven waar vereist behouden.</p></form>}
          </div>
        </div>
      </article>
    })}</div>
  </main>
}
