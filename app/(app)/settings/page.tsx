import Link from 'next/link'
import { createClient } from '@/lib/supabase/crew-server'
import { getCurrentUser } from '@/lib/actions/auth'
import { ProfileForm } from '@/components/crew/profile-form'
import { LanguageSwitcher } from '@/components/language-switcher'

export const dynamic='force-dynamic'

export default async function Page(){
  const current=await getCurrentUser()
  if(!current)return null
  const s=await createClient()
  const [{data,error},{data:preference},{data:workplaceOptions}]=await Promise.all([
    s.rpc('upt_own_profile_details'),
    s.rpc('upt_own_workplace_preference'),
    s.rpc('upt_profile_workplace_options'),
  ])
  const profile=data?.[0]
  let photoUrl:string|null=null
  if(profile?.profile_photo_url){
    const {data:signed}=await s.storage.from('profile-photos').createSignedUrl(profile.profile_photo_url,300)
    photoUrl=signed?.signedUrl||null
  }

  return <main className="mx-auto max-w-5xl space-y-5 p-5 pb-28">
    <header>
      <p className="text-xs font-black uppercase tracking-[.2em] text-violet-400">{current.isAdmin?'BEHEER & INSTELLINGEN':'INSTELLINGEN'}</p>
      <h1 className="text-3xl font-black">{current.isAdmin?'Beheer':'Profiel'}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{current.isAdmin?'Persoonlijke instellingen en technisch platformbeheer op één plaats.':'Beheer je profiel, voorkeuren en taal.'}</p>
    </header>

    {current.isAdmin&&<section className="grid gap-3 md:grid-cols-2">
      <Link href="/admin/platform" className="rounded-2xl border p-4 hover:border-violet-500/60">
        <h2 className="font-black">Platformbeheer</h2>
        <p className="mt-1 text-sm text-muted-foreground">Automatiseringen, planningvoorstellen, eventtemplates, AI, assets, QR, rollouts, rapportage en recovery.</p>
        <p className="mt-3 text-sm font-semibold text-violet-400">Open platformbeheer →</p>
      </Link>
      <Link href="/audit" className="rounded-2xl border p-4 hover:border-violet-500/60">
        <h2 className="font-black">Audit & historiek</h2>
        <p className="mt-1 text-sm text-muted-foreground">Controleer wie welke beheeractie uitvoerde en wanneer een wijziging plaatsvond.</p>
        <p className="mt-3 text-sm font-semibold text-violet-400">Open audit →</p>
      </Link>
    </section>}

    <section className="rounded-2xl border p-4">
      <div className="mb-4"><h2 className="text-xl font-black">Profiel</h2><p className="text-sm text-muted-foreground">{profile?.email||current.email}</p></div>
      {error||!profile
        ? <p>Profiel kon niet worden geladen.</p>
        : <ProfileForm id={current.id} initial={profile} photoUrl={photoUrl} preferredWorkplaceId={preference||null} workplaceOptions={(workplaceOptions||[]).map(option=>({id:option.id,name:option.name}))}/>}
    </section>

    <section className="rounded-2xl border p-4">
      <h2 className="mb-1 text-xl font-black">Taal</h2>
      <p className="mb-3 text-sm text-muted-foreground">De app volgt standaard de taal van je toestel. Een handmatige keuze wordt op dit toestel onthouden.</p>
      <LanguageSwitcher/>
    </section>
  </main>
}
