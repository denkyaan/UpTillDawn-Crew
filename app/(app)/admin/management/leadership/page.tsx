import Link from 'next/link'
import {redirect} from 'next/navigation'
import {revalidatePath} from 'next/cache'
import {createClient} from '@/lib/supabase/crew-server'
import {getCurrentUser} from '@/lib/actions/auth'
import {requestUiLocale} from '@/lib/server-locale'

export const dynamic='force-dynamic'
type Slot='head'|'left_hand'|'right_hand'
type Row={slot:Slot;user_id:string}
type Person={id:string;full_name:string|null;role:string}
const slotNames={
 nl:{head:'Hoofdadmin',left_hand:'Linkerhand',right_hand:'Rechterhand'},
 fr:{head:'Admin principal',left_hand:'Bras gauche',right_hand:'Bras droit'},
 en:{head:'Head Admin',left_hand:'Left hand',right_hand:'Right hand'},
 de:{head:'Hauptadmin',left_hand:'Linke Hand',right_hand:'Rechte Hand'}
} as const
const words={
 nl:{heading:'Leiding en bevoegdheden',back:'Terug naar beheer',intro:'Eén Hoofdadmin heeft de eindbeslissing. De Linkerhand en Rechterhand krijgen toegang tot Administratie om voor te bereiden en te beheren, maar kunnen geen definitieve Admin-goedkeuring uitvoeren.',claim:'Ik word Hoofdadmin',claimInfo:'Er zijn al Adminaccounts. Door zelf Hoofdadmin te worden, verliezen alle andere accounts hun volledige Adminrol en behouden ze hun gegevens. Wijs hen daarna indien nodig aan als Linkerhand of Rechterhand.',confirm:'Ik bevestig de wijziging van Adminrechten',appoint:'Toewijzen',transfer:'Hoofdadmin overdragen',remove:'Vrijmaken',choose:'Kies een goedgekeurde gebruiker',empty:'Nog niet toegewezen',saved:'Wijzigingen opgeslagen.',failed:'Toewijzing geweigerd. Controleer de accountrechten of gekozen gebruiker.',unavailable:'Leidinggegevens konden niet worden geladen.',rights:'Alleen de Hoofdadmin kan de assistenten aanwijzen of wijzigen.',noHead:'Er is nog geen Hoofdadmin aangewezen.',transferInfo:'Overdracht is definitief: de nieuwe Hoofdadmin krijgt de volledige Adminrol en de vorige Hoofdadmin verliest deze.'},
 fr:{heading:'Direction et autorisations',back:'Retour à la gestion',intro:'Un seul administrateur principal prend les décisions finales. Les deux adjoints peuvent préparer et gérer l’Administration, sans validation finale.',claim:'Devenir admin principal',claimInfo:'En acceptant ce rôle, tous les autres administrateurs perdent leurs droits Admin complets, sans perte de données. Vous pourrez ensuite les désigner comme adjoints.',confirm:'Je confirme le changement des droits Admin',appoint:'Attribuer',transfer:'Transférer le rôle principal',remove:'Libérer',choose:'Choisir un utilisateur approuvé',empty:'Non attribué',saved:'Modifications enregistrées.',failed:'Attribution refusée. Vérifiez les droits et le compte.',unavailable:'Impossible de charger la direction.',rights:'Seul l’admin principal peut désigner ou modifier les adjoints.',noHead:'Aucun admin principal désigné.',transferInfo:'Le transfert donne tous les droits Admin au nouveau responsable et les retire à l’ancien.'},
 en:{heading:'Leadership and permissions',back:'Back to management',intro:'One Head Admin makes final decisions. The Left and Right hands can prepare and manage Administration but cannot give final Admin approval.',claim:'Claim Head Admin',claimInfo:'Claiming Head Admin removes full Admin access from every other Admin account without deleting their data. You can then appoint them as Left or Right hand.',confirm:'I confirm the Admin permission changes',appoint:'Assign',transfer:'Transfer Head Admin',remove:'Clear slot',choose:'Select an approved user',empty:'Not assigned',saved:'Changes saved.',failed:'Assignment rejected. Check account rights and selected user.',unavailable:'Leadership information could not be loaded.',rights:'Only Head Admin can appoint or change the deputies.',noHead:'No Head Admin is assigned yet.',transferInfo:'Transfer is immediate: the new Head receives full Admin rights and the former Head loses them.'},
 de:{heading:'Leitung und Berechtigungen',back:'Zurück zur Verwaltung',intro:'Ein Hauptadmin trifft die endgültigen Entscheidungen. Linke und Rechte Hand unterstützen in der Verwaltung, ohne endgültige Adminfreigaben.',claim:'Hauptadmin werden',claimInfo:'Durch die Übernahme verlieren alle anderen Admin-Konten die vollständigen Adminrechte, jedoch keine Daten. Danach können sie als Stellvertreter zugewiesen werden.',confirm:'Ich bestätige die Änderung der Adminrechte',appoint:'Zuweisen',transfer:'Hauptadmin übertragen',remove:'Freigeben',choose:'Genehmigten Benutzer wählen',empty:'Nicht zugewiesen',saved:'Änderungen gespeichert.',failed:'Zuweisung abgelehnt. Konto und Rechte prüfen.',unavailable:'Leitungsdaten konnten nicht geladen werden.',rights:'Nur der Hauptadmin darf Stellvertreter bestimmen oder ändern.',noHead:'Noch kein Hauptadmin zugewiesen.',transferInfo:'Bei Übertragung erhält der neue Hauptadmin vollständige Rechte, der bisherige verliert sie.'}
} as const

async function assign(form:FormData){
 'use server'
 const user=await getCurrentUser()
 if(!user?.realIsAdmin||(!user.approved&&!user.isOwner))redirect('/portals')
 const slot=String(form.get('slot'))
 if(!['head','left_hand','right_hand'].includes(slot))throw Error('Invalid slot')
 const targetValue=String(form.get('user_id')??'')
 if(targetValue&& !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetValue))throw Error('Invalid account')
 if(slot==='head'&&!targetValue)throw Error('A Head is required')
 if(slot==='head'&&form.get('confirmed')!=='yes')throw Error('Confirmation required')
 const db=await createClient()
 const {error}=await db.rpc('upt_leadership_assign' as never,{p_slot:slot,p_user:targetValue||null} as never)
 if(error)redirect('/admin/management/leadership?error=1')
 revalidatePath('/admin/management/leadership')
 revalidatePath('/portals/administration')
 if(slot==='head'&&targetValue!==user.id)redirect('/portals')
 redirect('/admin/management/leadership?saved=1')
}

export default async function LeadershipManagement({searchParams}:{searchParams:Promise<{saved?:string;error?:string}>}){
 const user=await getCurrentUser()
 if(!user?.realIsAdmin||(!user.approved&&!user.isOwner))redirect('/portals')
 const locale=await requestUiLocale()
 const t=words[locale], names=slotNames[locale], db=await createClient()
 const [leadership,people,search]=await Promise.all([
  db.from('upt_organization_leadership').select('slot,user_id'),
  db.rpc('upt_admin_operational_profiles'),
  searchParams
 ])
 if(leadership.error||people.error)return <main className="mx-auto max-w-3xl p-6" role="alert">{t.unavailable}</main>
 const rows=(leadership.data??[]) as Row[]
 const candidates=((people.data??[]) as Person[]).filter(p=>p.id&&p.full_name?.trim())
 const bySlot=new Map(rows.map(row=>[row.slot,row.user_id]))
 const head=bySlot.get('head')
 const isHead=!head||head===user.id||user.isOwner
 const fullName=(id:string|undefined)=>candidates.find(p=>p.id===id)?.full_name||id?.slice(0,8)||t.empty
 return <main className="mx-auto max-w-4xl space-y-5 p-4 pb-36 lg:p-8">
  <Link href="/admin/management" className="text-sm text-violet-400">{t.back}</Link>
  <div><h1 className="text-2xl font-bold">{t.heading}</h1><p className="mt-2 text-sm text-muted-foreground">{t.intro}</p></div>
  {search.saved==='1'&&<p role="status" className="rounded border p-3 text-sm">{t.saved}</p>}
  {search.error==='1'&&<p role="alert" className="rounded border p-3 text-sm text-destructive">{t.failed}</p>}
  {!head&&<section className="space-y-3 rounded-2xl border p-4">
    <h2 className="font-semibold">{t.noHead}</h2>
    <p className="text-sm text-amber-600">{t.claimInfo}</p>
    <form action={assign} className="space-y-3">
     <input type="hidden" name="slot" value="head"/>
     <input type="hidden" name="user_id" value={user.id}/>
     <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirmed" value="yes" required/>{t.confirm}</label>
     <button className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white">{t.claim}</button>
    </form>
   </section>}
  {head&&<section className="rounded-2xl border p-4"><h2 className="font-semibold">{names.head}</h2><p className="mt-1 text-sm">{fullName(head)}</p>
   {isHead&&<details className="mt-3"><summary className="cursor-pointer text-sm text-violet-400">{t.transfer}</summary>
    <p className="my-2 text-sm text-amber-600">{t.transferInfo}</p>
    <form action={assign} className="flex flex-col gap-3">
      <input type="hidden" name="slot" value="head"/>
      <select name="user_id" required defaultValue="" className="rounded-lg border bg-background p-2 text-sm">
        <option value="" disabled>{t.choose}</option>
        {candidates.filter(p=>p.id!==head&&!rows.some(r=>r.user_id===p.id&&r.slot!=='head')).map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}
      </select>
      <label className="flex gap-2 text-sm"><input type="checkbox" name="confirmed" value="yes" required/>{t.confirm}</label>
      <button className="rounded-lg border px-4 py-2 text-sm">{t.transfer}</button>
    </form>
   </details>}</section>}
  {head&&<div className="grid gap-4 md:grid-cols-2">{(['left_hand','right_hand'] as const).map(slot=><section key={slot} className="space-y-3 rounded-2xl border p-4">
   <h2 className="text-lg font-semibold">{names[slot]}</h2>
   <p className="text-sm text-muted-foreground">{fullName(bySlot.get(slot))}</p>
   {isHead?<form action={assign} className="space-y-2">
    <input type="hidden" name="slot" value={slot}/>
    <select name="user_id" defaultValue={bySlot.get(slot)||''} className="w-full rounded-lg border bg-background p-2 text-sm">
      <option value="">{t.empty}</option>
      {candidates.filter(p=>p.id!==head&&!rows.some(r=>r.user_id===p.id&&r.slot!==slot)).map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}
    </select>
    <button className="rounded-lg border px-4 py-2 text-sm font-semibold">{t.appoint}</button>
   </form>:<p className="text-sm text-muted-foreground">{t.rights}</p>}
  </section>)}</div>}
 </main>
}
