'use client'

import {useState,useTransition} from 'react'
import {useRouter} from 'next/navigation'
import {changePortalRole} from '@/lib/actions/portal-roles'
import type {SupportedUiLocale} from '@/lib/locale-preferences'
import type {Portal} from '@/lib/portal-access'

type UserOption={id:string;full_name:string|null}
type RoleAction='assign_approved'|'approve'|'revoke'

const copy={
 nl:{search:'Medewerker zoeken',user:'Gebruiker',choose:'Kies een medewerker',portal:'Portaal',role:'Rol',action:'Actie',assign:'Toewijzen en goedkeuren',approve:'Goedkeuren',revoke:'Intrekken',restore:'Opnieuw toewijzen',submit:'Rolwijziging uitvoeren',busy:'Bezig met opslaan…',saved:'Rolwijziging opgeslagen.',failed:'Rolwijziging niet uitgevoerd.',confirm:'Deze portaalrol intrekken? De medewerker verliest de bijbehorende toegang.',events:'Evenementen',promotion:'Promotie',administration:'Administratie',event_staff:'Eventmedewerker',event_responsible:'Eventverantwoordelijke',promoter:'Promotiemedewerker',administrative_staff:'Administratief medewerker'},
 fr:{search:'Rechercher un membre',user:'Utilisateur',choose:'Choisir un membre',portal:'Portail',role:'Rôle',action:'Action',assign:'Attribuer et approuver',approve:'Approuver',revoke:'Révoquer',restore:'Réattribuer',submit:'Enregistrer le rôle',busy:'Enregistrement…',saved:'Rôle mis à jour.',failed:'Modification du rôle impossible.',confirm:'Révoquer ce rôle ? Le membre perdra l’accès correspondant.',events:'Événements',promotion:'Promotion',administration:'Administration',event_staff:'Équipier événementiel',event_responsible:'Responsable événementiel',promoter:'Promoteur',administrative_staff:'Employé administratif'},
 en:{search:'Find staff member',user:'User',choose:'Choose a staff member',portal:'Portal',role:'Role',action:'Action',assign:'Assign and approve',approve:'Approve',revoke:'Revoke',restore:'Reassign',submit:'Save role change',busy:'Saving…',saved:'Role change saved.',failed:'Unable to change role.',confirm:'Revoke this portal role? This person will lose the related access.',events:'Events',promotion:'Promotion',administration:'Administration',event_staff:'Event staff',event_responsible:'Responsible lead',promoter:'Promoter',administrative_staff:'Administration staff'},
 de:{search:'Mitarbeiter suchen',user:'Benutzer',choose:'Mitarbeiter auswählen',portal:'Portal',role:'Rolle',action:'Aktion',assign:'Zuweisen und genehmigen',approve:'Genehmigen',revoke:'Widerrufen',restore:'Erneut zuweisen',submit:'Rollenänderung speichern',busy:'Speichern…',saved:'Rollenänderung gespeichert.',failed:'Rollenänderung fehlgeschlagen.',confirm:'Diese Portalrolle widerrufen? Die zugehörige Berechtigung geht verloren.',events:'Veranstaltungen',promotion:'Promotion',administration:'Verwaltung',event_staff:'Eventmitarbeiter',event_responsible:'Eventverantwortlicher',promoter:'Promotionsmitarbeiter',administrative_staff:'Verwaltungsmitarbeiter'},
} as const

const roleOptions:Record<Portal,readonly string[]>={
 events:['event_staff','event_responsible'],
 promotion:['promoter'],
 administration:['administrative_staff'],
}
const PORTAL_OPTIONS=['events','promotion','administration'] as const

export function RoleManagementForm({users,locale}:{users:UserOption[];locale:SupportedUiLocale}){
 const t=copy[locale]
 const router=useRouter()
 const [portal,setPortal]=useState<Portal>('events')
 const [role,setRole]=useState('event_staff')
 const [action,setAction]=useState('assign_approved')
 const [userId,setUserId]=useState(users[0]?.id??'')
 const [search,setSearch]=useState('')
 const [result,setResult]=useState('')
 const [pending,startTransition]=useTransition()
 const matches=users.filter(user=>(user.full_name??'').toLocaleLowerCase().includes(search.toLocaleLowerCase())||
  user.id.includes(search)).slice(0,100)
 const selectedUserVisible = matches.some(user => user.id === userId)

 function submit(formData:FormData){
  if (pending) return
  if (formData.get('action') === 'revoke' && !window.confirm(t.confirm)) return
  setResult('')
  startTransition(async()=>{
   try{await changePortalRole(formData);setResult(t.saved);router.refresh()}
   catch{setResult(t.failed)}
  })
 }
 return <form action={submit} className="grid gap-3 sm:grid-cols-2">
  <label className="grid gap-1 text-sm">{t.search}
   <input value={search} onChange={event=>setSearch(event.target.value)} className="rounded border bg-background p-2"/>
  </label>
  <label className="grid gap-1 text-sm">{t.user}
   <select required name="user_id" value={selectedUserVisible ? userId : ""}
    onChange={event=>setUserId(event.target.value)} className="rounded border bg-background p-2">
    {!selectedUserVisible && <option value="" disabled>{t.choose}</option>}
    {matches.map(user=><option key={user.id} value={user.id}>{user.full_name||user.id}</option>)}
   </select>
  </label>
  <label className="grid gap-1 text-sm">{t.portal}
   <select name="portal" value={portal} onChange={event=>{
    const next=event.target.value as Portal
    if(!PORTAL_OPTIONS.includes(next))return
    setPortal(next);setRole(roleOptions[next][0])
   }} className="rounded border bg-background p-2">
    {PORTAL_OPTIONS.map(value=><option key={value} value={value}>{t[value]}</option>)}
   </select>
  </label>
  <label className="grid gap-1 text-sm">{t.role}
   <select name="role" value={role} onChange={event=>setRole(event.target.value)}
    className="rounded border bg-background p-2">
    {roleOptions[portal].map(value=><option key={value} value={value}>
     {t[value as keyof typeof t]}
    </option>)}
   </select>
  </label>
  <label className="grid gap-1 text-sm">{t.action}
   <select name="action" value={action} onChange={event=>{
    const next=event.target.value as RoleAction
    if(next==='assign_approved'||next==='approve'||next==='revoke')setAction(next)
   }} className="rounded border bg-background p-2">
    <option value="assign_approved">{t.assign}</option>
    <option value="approve">{t.approve}</option>
    <option value="revoke">{t.revoke}</option>
   </select>
  </label>
  <button type="submit" disabled={pending || !userId || !selectedUserVisible}
   className="rounded bg-violet-600 px-4 py-2 font-medium text-white disabled:opacity-50">
   {pending?t.busy:t.submit}
  </button>
  {result&&<p role="status" aria-live="polite" className="sm:col-span-2">{result}</p>}
 </form>
}

export function RoleQuickAction({userId,portal,role,action,locale}:{
 userId:string;portal:string;role:string;action:RoleAction;locale:SupportedUiLocale
}){
 const [pending,startTransition]=useTransition()
 const [result,setResult]=useState('')
 const router=useRouter()
 const t=copy[locale]
 const label=action==='approve'?t.approve:action==='revoke'?t.revoke:t.restore
 return <div className="flex flex-col gap-1">
  <button type="button" disabled={pending}
   className="rounded border border-violet-500 px-3 py-1 text-violet-400 disabled:opacity-50"
   onClick={()=>{
    if (pending) return
    if (action === 'revoke' && !window.confirm(t.confirm)) return
    const form=new FormData()
    form.set('user_id',userId);form.set('portal',portal);form.set('role',role);form.set('action',action)
    setResult('')
    startTransition(async()=>{
     try{await changePortalRole(form);setResult(t.saved);router.refresh()}
     catch{setResult(t.failed)}
    })
   }}>{pending?t.busy:label}</button>
  {result&&<span role="status" aria-live="polite" className="text-xs">{result}</span>}
 </div>
}
