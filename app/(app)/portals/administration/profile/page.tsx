import {redirect} from 'next/navigation'
import {administrationAccess} from '@/lib/administration/access'
import {requestUiLocale} from '@/lib/server-locale'
import {ProfileForm} from '@/components/crew/profile-form'
import {LanguageSwitcher} from '@/components/language-switcher'

export const dynamic='force-dynamic'

export default async function AdministrationProfile(){
 const access=await administrationAccess()
 if(!access.ok)redirect('/portals')
 const {db,user}=access
 const locale=await requestUiLocale()
 const t=({nl:{title:'Mijn profiel',language:'Taal',error:'Profiel kon niet worden geladen.'},fr:{title:'Mon profil',language:'Langue',error:'Impossible de charger le profil.'},en:{title:'My profile',language:'Language',error:'Unable to load profile.'},de:{title:'Mein Profil',language:'Sprache',error:'Profil konnte nicht geladen werden.'}} as const)[locale]
 const [details,preference,options]=await Promise.all([db.rpc('upt_own_profile_details'),db.rpc('upt_own_workplace_preference'),db.rpc('upt_profile_workplace_options')])
 const profile=details.data?.[0]
 const photo=profile?.profile_photo_url?await db.storage.from('profile-photos').createSignedUrl(profile.profile_photo_url,300):null
 return <main className="mx-auto max-w-5xl space-y-5 p-5"><h1 className="text-2xl font-bold">{t.title}</h1>
  <section className="rounded-xl border p-4">{details.error||!profile?<p role="alert">{t.error}</p>:<ProfileForm id={user.id} initial={profile} photoUrl={photo?.data?.signedUrl} preferredWorkplaceId={preference.data||null} workplaceOptions={(options.data??[]).map(option=>({id:option.id,name:option.name}))} isAdminProfile={user.realRole==='admin'}/>}</section>
  <section className="rounded-xl border p-4"><h2 className="mb-3 text-xl font-bold">{t.language}</h2><LanguageSwitcher/></section>
 </main>
}
