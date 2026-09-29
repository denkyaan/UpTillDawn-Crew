import Link from 'next/link'
import { createClient } from '@/lib/supabase/crew-server'
import { ProfileForm } from '@/components/crew/profile-form'
import { LanguageSwitcher } from '@/components/language-switcher'
import { getCurrentUser } from '@/lib/actions/auth'

export const dynamic='force-dynamic'

const AdminCard=({href,title,description}:{href:string;title:string;description:string})=><Link href={href} className="rounded-2xl border p-4 transition hover:border-violet-500/60 hover:bg-muted/30"><h2 className="font-black">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></Link>

export default async function Page(){
  const s=await createClient()
  const [{data:{user}},current]=await Promise.all([s.auth.getUser(),getCurrentUser()])
  if(!user)return null

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
  const isAdmin=current?.isAdmin===true

  return <main className="mx-auto max-w-6xl space-y-6 p-5 pb-28">
    <header>
      <p className="text-xs font-black uppercase tracking-[.2em] text-violet-400">{isAdmin?'BEHEER':'PROFIEL'}</p>
      <h1 className="text-3xl font-black">{isAdmin?'Beheer':'Profiel'}</h1>
      <p className="text-sm text-muted-foreground">{isAdmin?'Centrale beheerhub voor profiel, taal, automatiseringen, platforminstellingen, audit en administratieve functies.':profile?.email||user.email}</p>
    </header>

    {isAdmin&&<section className="space-y-3">
      <div><h2 className="text-xl font-black">Platform & administratie</h2><p className="text-sm text-muted-foreground">Geavanceerde onderdelen staan hier gegroepeerd zodat de hoofdmenu’s operationeel en overzichtelijk blijven.</p></div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <AdminCard href="/admin/platform" title="Platform & automatiseringen" description="AI, automatische planning, eventtemplates, rollouts, QR, recovery, rapportage en technische configuratie."/>
        <AdminCard href="/operations" title="Werkurenbeheer" description="Live werkuren, check-in/out, pauzes, operationele waarschuwingen en goedkeuringen."/>
        <AdminCard href="/admin/time-records" title="Tijdcorrecties" description="Controleer en corrigeer geregistreerde tijden. Elke correctie blijft auditbaar."/>
        <AdminCard href="/exports" title="Excel-export" description="Exporteer uren en administratieve gegevens vanuit de werkurenworkflow."/>
        <AdminCard href="/audit" title="Auditlog" description="Bekijk wijzigingshistoriek en administratieve acties voor controle en traceerbaarheid."/>
        <AdminCard href="/notifications" title="Meldingen" description="Bekijk operationele meldingen, herinneringen en automatische waarschuwingen."/>
        <AdminCard href="/events" title="Eventdefaults & templates" description="Beheer events, templates, briefing, documenten, readiness, afsluiting en archief."/>
        <AdminCard href="/workplaces" title="Werkplaatsen, inventory & inkom" description="Beheer planning en open de interne inventaris- en inkommodules per werkplek."/>
        <AdminCard href="/god-mode/login" title="God Mode" description="Makeromgeving voor diepgaande interface-, workflow-, automatiserings- en codewijzigingen."/>
      </div>
    </section>}

    <section className="rounded-2xl border p-4">
      <div className="mb-4"><h2 className="text-xl font-black">Mijn profiel</h2><p className="text-sm text-muted-foreground">{profile?.email||user.email}</p></div>
      {error||!profile
        ? <p>Profiel kon niet worden geladen.</p>
        : <ProfileForm id={user.id} initial={profile} photoUrl={photoUrl} preferredWorkplaceId={preference||null} workplaceOptions={(workplaceOptions||[]).map(option=>({id:option.id,name:option.name}))}/>}
    </section>

    <section className="rounded-2xl border p-4">
      <h2 className="mb-2 text-xl font-black">Taal</h2>
      <p className="mb-3 text-sm text-muted-foreground">De app gebruikt standaard de toestel taal. Een handmatige keuze wordt op dit toestel onthouden.</p>
      <LanguageSwitcher/>
    </section>
  </main>
}
