'use client'

import {useActionState,useState} from 'react'
import {PendingSubmitButton} from '@/components/ui/pending-submit-button'
import {savePersonnelRoleSlot,type RoleSaveState} from '@/lib/actions/personnel-dual-roles'
import type {SupportedUiLocale} from '@/lib/locale-preferences'

const roleLabels={
 nl:{staff:'Personeel',responsible_lead:'Verantwoordelijke',promotion:'Promotie',administration:'Administratie',head:'Hoofdadmin',left_hand:'Linkerhand',right_hand:'Rechterhand',none:'Geen tweede rol',first:'Rol 1',second:'Rol 2 (optioneel)',save:'Rol opslaan',confirm:'Ik bevestig de overdracht van de Hoofdadminrechten',note:'Kies voor elke rol afzonderlijk en sla deze op. De tweede rol is optioneel.'},
 fr:{staff:'Personnel',responsible_lead:'Responsable',promotion:'Promotion',administration:'Administration',head:'Admin principal',left_hand:'Bras gauche',right_hand:'Bras droit',none:'Aucun deuxième rôle',first:'Rôle 1',second:'Rôle 2 (facultatif)',save:'Enregistrer le rôle',confirm:'Je confirme le transfert des droits du responsable principal',note:'Enregistrez chaque rôle séparément. Le deuxième rôle est facultatif.'},
 en:{staff:'Staff',responsible_lead:'Responsible',promotion:'Promotion',administration:'Administration',head:'Head Admin',left_hand:'Left hand',right_hand:'Right hand',none:'No second role',first:'Role 1',second:'Role 2 (optional)',save:'Save role',confirm:'I confirm the Head Admin transfer',note:'Choose and save each role separately. The second role is optional.'},
 de:{staff:'Personal',responsible_lead:'Verantwortliche',promotion:'Promotion',administration:'Verwaltung',head:'Hauptadmin',left_hand:'Linke Hand',right_hand:'Rechte Hand',none:'Keine zweite Rolle',first:'Rolle 1',second:'Rolle 2 (optional)',save:'Rolle speichern',confirm:'Ich bestätige die Übertragung der Hauptadminrechte',note:'Beide Rollen getrennt speichern. Die zweite Rolle ist optional.'}
} as const
export type AssignableRole='staff'|'responsible_lead'|'promotion'|'administration'|'head'|'left_hand'|'right_hand'
export const assignableRoles:AssignableRole[]=['staff','responsible_lead','promotion','administration','head','left_hand','right_hand']
const leadershipRoles:AssignableRole[]=['head','left_hand','right_hand']
function conflict(one:AssignableRole,two:AssignableRole|null){
 if(!two)return false
 if(one===two)return true
 if((one==='staff'&&two==='responsible_lead')||(one==='responsible_lead'&&two==='staff'))return true
 if(leadershipRoles.includes(one)&&leadershipRoles.includes(two))return true
 if((one==='administration'&&leadershipRoles.includes(two))||(two==='administration'&&leadershipRoles.includes(one)))return true
 return false
}
const initialState:RoleSaveState={error:null}
export function PersonnelTwoRoleEditor({userId,roleOne,roleTwo,locale}:{userId:string;roleOne:AssignableRole;roleTwo:AssignableRole|null;locale:SupportedUiLocale}){
 const t=roleLabels[locale]
 const [one,setOne]=useState<AssignableRole>(roleOne)
 const [two,setTwo]=useState<AssignableRole|'none'>(roleTwo??'none')
 const [firstState,firstAction,firstPending]=useActionState(savePersonnelRoleSlot,initialState)
 const [secondState,secondAction,secondPending]=useActionState(savePersonnelRoleSlot,initialState)
 return <section aria-label={t.first+' / '+t.second} className="mt-3 space-y-3">
  <p className="text-xs text-muted-foreground">{t.note}</p>
  <div className="grid gap-3 md:grid-cols-2">
   <form action={firstAction} className="grid content-start gap-2 rounded-lg border p-3">
    <input type="hidden" name="user_id" value={userId}/>
    <input type="hidden" name="role_two" value={roleTwo??'none'}/>
    <input type="hidden" name="save_slot" value="1"/>
    <label className="grid gap-1 text-sm font-semibold">{t.first}
     <select name="role_one" value={one} onChange={event=>setOne(event.target.value as AssignableRole)} className="w-full min-w-0 rounded-lg border bg-background p-2">
      {assignableRoles.map(role=><option key={role} value={role} disabled={conflict(role,roleTwo)}>{t[role]}</option>)}
     </select>
    </label>
    {one==='head'&&roleOne!=='head'&&<label className="flex items-start gap-2 text-xs"><input type="checkbox" name="confirm_head" value="yes" required/>{t.confirm}</label>}
    <PendingSubmitButton pendingLabel="…" disabled={firstPending||conflict(one,roleTwo)} className="rounded-lg bg-violet-600 px-3 py-2 font-bold text-white">{t.save}</PendingSubmitButton>
    {firstState.error&&<p role="alert" className="text-xs text-red-500">{firstState.error}</p>}
   </form>
   <form action={secondAction} className="grid content-start gap-2 rounded-lg border p-3">
    <input type="hidden" name="user_id" value={userId}/>
    <input type="hidden" name="role_one" value={roleOne}/>
    <input type="hidden" name="save_slot" value="2"/>
    <label className="grid gap-1 text-sm font-semibold">{t.second}
     <select name="role_two" value={two} onChange={event=>setTwo(event.target.value as AssignableRole|'none')} className="w-full min-w-0 rounded-lg border bg-background p-2">
      <option value="none">{t.none}</option>
      {assignableRoles.map(role=><option key={role} value={role} disabled={conflict(roleOne,role)}>{t[role]}</option>)}
     </select>
    </label>
    {two==='head'&&roleTwo!=='head'&&<label className="flex items-start gap-2 text-xs"><input type="checkbox" name="confirm_head" value="yes" required/>{t.confirm}</label>}
    <PendingSubmitButton pendingLabel="…" disabled={secondPending||conflict(roleOne,two==='none'?null:two)} className="rounded-lg bg-violet-600 px-3 py-2 font-bold text-white">{t.save}</PendingSubmitButton>
    {secondState.error&&<p role="alert" className="text-xs text-red-500">{secondState.error}</p>}
   </form>
  </div>
 </section>
}
