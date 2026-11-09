import {PendingSubmitButton} from '@/components/ui/pending-submit-button'
import {savePersonnelRoleSlot} from '@/lib/actions/personnel-dual-roles'
import {requestUiLocale} from '@/lib/server-locale'
const roleLabels={
 nl:{staff:'Personeel',responsible_lead:'Verantwoordelijke',promotion:'Promotie',administration:'Administratie',head:'Hoofdadmin',left_hand:'Linkerhand',right_hand:'Rechterhand',none:'Geen tweede rol',first:'Rol 1',second:'Rol 2 (optioneel)',save:'Rol opslaan',confirm:'Ik bevestig de eventuele wijziging van de Hoofdadmin en Adminrechten',note:'Elke rol heeft een eigen Opslaan-knop. De Hoofdadmin kan zijn eigen dossiers goedkeuren. Extra rollen en bevoegdheden worden hier samen beheerd.'},
 fr:{staff:'Personnel',responsible_lead:'Responsable',promotion:'Promotion',administration:'Administration',head:'Admin principal',left_hand:'Bras gauche',right_hand:'Bras droit',none:'Aucun deuxième rôle',first:'Rôle 1',second:'Rôle 2 (facultatif)',save:'Enregistrer le rôle',confirm:'Je confirme un éventuel transfert de l’admin principal et des droits Admin',note:'Chaque rôle est enregistré séparément. L’admin principal peut approuver ses propres dossiers.'},
 en:{staff:'Staff',responsible_lead:'Responsible',promotion:'Promotion',administration:'Administration',head:'Head Admin',left_hand:'Left hand',right_hand:'Right hand',none:'No second role',first:'Role 1',second:'Role 2 (optional)',save:'Save role',confirm:'I confirm any change of Head Admin and Admin permissions',note:'Each role has its own Save button. The Head Admin can approve their own cases.'},
 de:{staff:'Personal',responsible_lead:'Verantwortliche',promotion:'Promotion',administration:'Verwaltung',head:'Hauptadmin',left_hand:'Linke Hand',right_hand:'Rechte Hand',none:'Keine zweite Rolle',first:'Rolle 1',second:'Rolle 2 (optional)',save:'Rolle speichern',confirm:'Ich bestätige gegebenenfalls die Änderung des Hauptadmins und der Adminrechte',note:'Jede Rolle hat eine eigene Speichern-Schaltfläche. Der Hauptadmin darf eigene Vorgänge genehmigen.'}
} as const
export type AssignableRole='staff'|'responsible_lead'|'promotion'|'administration'|'head'|'left_hand'|'right_hand'
export const assignableRoles:AssignableRole[]=['staff','responsible_lead','promotion','administration','head','left_hand','right_hand']
export async function PersonnelTwoRoleEditor({userId,roleOne,roleTwo}:{userId:string;roleOne:AssignableRole;roleTwo:AssignableRole|null}){
 const locale=await requestUiLocale()
 const t=roleLabels[locale]
 return <section aria-label={t.first+' / '+t.second} className="mt-4 space-y-3 rounded-xl border p-3">
  <p className="text-xs text-muted-foreground">{t.note}</p>
  <div className="grid gap-3 md:grid-cols-2">
   <form action={savePersonnelRoleSlot} className="grid content-start gap-2 rounded-lg border p-3">
    <input type="hidden" name="user_id" value={userId}/>
    <input type="hidden" name="role_two" value={roleTwo??'none'}/>
    <input type="hidden" name="save_slot" value="1"/>
    <label className="grid gap-1 text-sm font-semibold">{t.first}
     <select name="role_one" defaultValue={roleOne} className="w-full rounded-lg border bg-background p-2">
      {assignableRoles.map(role=><option key={role} value={role}>{t[role]}</option>)}
     </select>
    </label>
    <label className="flex items-start gap-2 text-xs"><input type="checkbox" name="confirm_head" value="yes"/>{t.confirm}</label>
    <PendingSubmitButton pendingLabel="…" className="rounded-lg bg-violet-600 px-3 py-2 font-bold text-white">{t.save}</PendingSubmitButton>
   </form>
   <form action={savePersonnelRoleSlot} className="grid content-start gap-2 rounded-lg border p-3">
    <input type="hidden" name="user_id" value={userId}/>
    <input type="hidden" name="role_one" value={roleOne}/>
    <input type="hidden" name="save_slot" value="2"/>
    <label className="grid gap-1 text-sm font-semibold">{t.second}
     <select name="role_two" defaultValue={roleTwo??'none'} className="w-full rounded-lg border bg-background p-2">
      <option value="none">{t.none}</option>
      {assignableRoles.map(role=><option key={role} value={role}>{t[role]}</option>)}
     </select>
    </label>
    <label className="flex items-start gap-2 text-xs"><input type="checkbox" name="confirm_head" value="yes"/>{t.confirm}</label>
    <PendingSubmitButton pendingLabel="…" className="rounded-lg bg-violet-600 px-3 py-2 font-bold text-white">{t.save}</PendingSubmitButton>
   </form>
  </div>
 </section>
}
