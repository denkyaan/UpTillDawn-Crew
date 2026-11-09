import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/crew-server'
import { requestUiLocale } from '@/lib/server-locale'
import { listPage } from '@/lib/list-query'
import { RoleManagementForm, RoleQuickAction } from './role-management-form'

export const dynamic = 'force-dynamic'

const copy={
 nl:{directorySearch:"Zoek in alle goedgekeurde medewerkers",find:"Zoeken",directoryPage:"Medewerkerspagina",directoryEmpty:"Geen medewerkers gevonden. Pas je zoekopdracht aan.",heading:'Portaalrollen',intro:'Goedkeuringen en rollen per portaal. Een account kan meerdere rollen hebben.',empty:'Er zijn geen roltoewijzingen op deze pagina.',error:'Roltoewijzingen konden niet worden geladen.',back:'Terug naar portalen',person:'Gebruiker',portal:'Portaal',role:'Rol',status:'Status',approved:'Goedgekeurd',pending:'In afwachting',revoked:'Ingetrokken',manage:'Portaalrollen beheren',action:'Actie',page:'Pagina',previous:'Vorige',next:'Volgende',partial:'De eerste 500 goedgekeurde medewerkers zijn beschikbaar in het toewijzingsformulier.'},
 fr:{directorySearch:"Rechercher parmi tous les membres approuvés",find:"Rechercher",directoryPage:"Page des membres",directoryEmpty:"Aucun membre trouvé. Modifiez la recherche.",heading:'Rôles des portails',intro:'Autorisations et rôles par portail. Un compte peut posséder plusieurs rôles.',empty:'Aucune attribution de rôle sur cette page.',error:'Impossible de charger les rôles.',back:'Retour aux portails',person:'Utilisateur',portal:'Portail',role:'Rôle',status:'Statut',approved:'Approuvé',pending:'En attente',revoked:'Révoqué',manage:'Gérer les rôles',action:'Action',page:'Page',previous:'Précédent',next:'Suivant',partial:'Les 500 premiers membres approuvés sont disponibles dans le formulaire.'},
 en:{directorySearch:"Search all approved staff members",find:"Search",directoryPage:"Staff page",directoryEmpty:"No matching staff. Adjust your search.",heading:'Portal roles',intro:'Approvals and roles by portal. One account may hold multiple roles.',empty:'No role assignments on this page.',error:'Unable to load portal roles.',back:'Back to portals',person:'User',portal:'Portal',role:'Role',status:'Status',approved:'Approved',pending:'Pending',revoked:'Revoked',manage:'Manage portal roles',action:'Action',page:'Page',previous:'Previous',next:'Next',partial:'The first 500 approved staff members are available in the assignment form.'},
 de:{directorySearch:"Alle genehmigten Mitarbeiter durchsuchen",find:"Suchen",directoryPage:"Mitarbeiterseite",directoryEmpty:"Keine passenden Mitarbeiter. Suche anpassen.",heading:'Portalrollen',intro:'Genehmigungen und Rollen je Portal. Ein Konto kann mehrere Rollen haben.',empty:'Keine Rollenzuweisungen auf dieser Seite.',error:'Portalrollen konnten nicht geladen werden.',back:'Zurück zu Portalen',person:'Benutzer',portal:'Portal',role:'Rolle',status:'Status',approved:'Genehmigt',pending:'Ausstehend',revoked:'Widerrufen',manage:'Portalrollen verwalten',action:'Aktion',page:'Seite',previous:'Zurück',next:'Weiter',partial:'Die ersten 500 genehmigten Mitarbeitenden stehen im Formular zur Verfügung.'},
} as const
const portalNames={
 events:{nl:'Evenementen',fr:'Événements',en:'Events',de:'Veranstaltungen'},
 promotion:{nl:'Promotie',fr:'Promotion',en:'Promotion',de:'Promotion'},
 administration:{nl:'Administratie',fr:'Administration',en:'Administration',de:'Verwaltung'},
} as const
const roleNames={
 event_staff:{nl:'Evenementenmedewerker',fr:'Équipier événementiel',en:'Event staff',de:'Eventmitarbeiter'},
 event_responsible:{nl:'Verantwoordelijke',fr:'Responsable',en:'Responsible lead',de:'Verantwortliche Person'},
 promoter:{nl:'Promotiemedewerker',fr:'Promoteur',en:'Promoter',de:'Promotionsmitarbeiter'},
 administrative_staff:{nl:'Administratief medewerker',fr:'Employé administratif',en:'Administration staff',de:'Verwaltungsmitarbeiter'},
 admin:{nl:'Admin',fr:'Admin',en:'Admin',de:'Admin'},
} as const

export default async function PortalRolesPage({searchParams}:{searchParams:Promise<{page?:string;userPage?:string;q?:string}>}) {
 const current=await getCurrentUser()
 if(!current)redirect('/login')
 const locale=await requestUiLocale()
 const t=copy[locale]
 const canManage = current.isOwner || (current.realIsAdmin && current.approved && !current.account_blocked)
 const db=await createClient()
 const {page:requestedPage,userPage:requestedUserPage,q:requestedQuery}=await searchParams
 const page=listPage(requestedPage,100000)
 const directoryPage=listPage(requestedUserPage,100000)
 const directorySize=100
 const directoryOffset=(directoryPage-1)*directorySize
 const query=typeof requestedQuery==="string"?requestedQuery.trim().slice(0,80):""
 const likeLiteral=(value:string)=>value.replace(/[\\%_*]/g,character=>"\\"+character)
 const pageSize=50
 const from=(page-1)*pageSize
 let query=db.from('portal_role_assignments')
  .select('id,user_id,portal,role,approved,revoked_at',{count:'exact'})
 if (!canManage) query = query.eq('user_id', current.id)
 const {data,error,count}=await query.order('created_at',{ascending:false}).order('id',{ascending:false})
  .range(from,from+pageSize-1)
 let directoryQuery=db.from('profiles')
  .select('id,full_name',{count:'exact'})
  .eq('approved',true).eq('account_blocked',false).neq('id',current.id)
 if(query){
  directoryQuery=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(query)
   ?directoryQuery.eq('id',query)
   :directoryQuery.ilike('full_name','%'+likeLiteral(query)+'%')
 }
 const userDirectory=canManage
  ?await directoryQuery.order('full_name',{ascending:true}).order('id',{ascending:true})
   .range(directoryOffset,directoryOffset+directorySize-1)
  :{data:null,error:null,count:null}
 const users=userDirectory.data??[]
 const usersError=userDirectory.error
 const displayedUserIds=[...new Set((data??[]).map(row=>row.user_id))]
 const displayedProfiles=displayedUserIds.length
  ?await db.from('profiles').select('id,full_name').in('id',displayedUserIds)
  :{data:[],error:null}
 const names=new Map([...users,...(displayedProfiles.data??[])].map(user=>[user.id,user.full_name||user.id]))
 const href=(params:{page?:number;userPage?:number;q?:string})=>{
  const out=new URLSearchParams()
  out.set('page',String(params.page??page))
  out.set('userPage',String(params.userPage??directoryPage))
  if(params.q??query)out.set('q',params.q??query)
  return '/portals/roles?'+out.toString()
 }
 const pageHref=(target:number)=>href({page:target})
 return <main className="mx-auto max-w-5xl space-y-5 p-4 pb-28 md:p-8">
  <Link href="/portals" className="text-sm font-semibold text-violet-400">{t.back}</Link>
  <h1 className="text-2xl font-bold">{t.heading}</h1>
  <p className="text-sm text-muted-foreground">{t.intro}</p>
  {canManage && <section className="space-y-3 rounded-xl border p-4">
   <h2 className="font-semibold">{t.manage}</h2>
   <form action="/portals/roles" method="get" className="flex flex-wrap items-end gap-2">
    <label className="grid min-w-0 flex-1 gap-1 text-sm">{t.directorySearch}
     <input type="search" name="q" defaultValue={query} maxLength={80}
      className="w-full rounded-lg border bg-background p-2"/>
    </label>
    <button type="submit" className="rounded-lg border px-4 py-2 text-sm font-semibold">{t.find}</button>
   </form>
   {usersError?<p role="alert" className="text-sm">{t.error}</p>:
    users.length?<RoleManagementForm users={users} locale={locale}/>:
    <p role="status" className="text-sm text-muted-foreground">{t.directoryEmpty}</p>}
   {!usersError&&userDirectory.count!==null&&(directoryPage>1||userDirectory.count>directoryPage*directorySize)&&
    <nav aria-label={t.directoryPage} className="flex items-center justify-between gap-3">
     <span className="text-sm">{t.directoryPage} {directoryPage}</span>
     <div className="flex gap-2">
      {directoryPage>1&&<Link href={href({userPage:directoryPage-1})} className="rounded-lg border px-3 py-2 text-sm">{t.previous}</Link>}
      {userDirectory.count>directoryPage*directorySize&&<Link href={href({userPage:directoryPage+1})} className="rounded-lg border px-3 py-2 text-sm">{t.next}</Link>}
     </div>
    </nav>}
  </section>}
  {error?<p role="alert" className="rounded-xl border border-amber-500/50 p-4">{t.error}</p>
   :!data?.length?<p className="rounded-xl border p-4">{t.empty}</p>:
   <div className="overflow-x-auto rounded-xl border"><table className="w-full text-left text-sm">
    <thead><tr className="border-b bg-card"><th className="p-3">{t.person}</th><th className="p-3">{t.portal}</th><th className="p-3">{t.role}</th><th className="p-3">{t.status}</th>{canManage && <th className="p-3">{t.action}</th>}</tr></thead>
    <tbody>{data.map(row=><tr key={row.id} className="border-b last:border-b-0">
     <td className="p-3 text-xs">{names.get(row.user_id)??row.user_id}</td>
     <td className="p-3">{row.portal in portalNames?portalNames[row.portal as keyof typeof portalNames][locale]:row.portal}</td>
     <td className="p-3">{row.role in roleNames?roleNames[row.role as keyof typeof roleNames][locale]:row.role}</td>
     <td className="p-3">{row.revoked_at?t.revoked:row.approved?t.approved:t.pending}</td>
     {canManage && <td className="p-3"><RoleQuickAction userId={row.user_id}
       portal={row.portal} role={row.role}
       action={row.revoked_at ? "assign_approved" : row.approved ? "revoke" : "approve"} locale={locale}/></td>}
    </tr>)}</tbody>
   </table></div>}
  {!error&&count!==null&&(page>1||count>page*pageSize)&&<nav aria-label={t.page} className="flex items-center justify-between gap-3 rounded-xl border p-3">
   <span className="text-sm">{t.page} {page}</span>
   <div className="flex gap-2">
    {page>1&&<Link href={pageHref(page-1)} className="rounded-lg border px-3 py-2 text-sm">{t.previous}</Link>}
    {count>page*pageSize&&<Link href={pageHref(page+1)} className="rounded-lg border px-3 py-2 text-sm">{t.next}</Link>}
   </div>
  </nav>}
 </main>
}
