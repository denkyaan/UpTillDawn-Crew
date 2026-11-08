import {randomUUID} from 'node:crypto'
import {createPromotionTask,editPromotionTask,assignGeneralPromotionTask} from '@/lib/actions/promotion-tasks'
import {PendingSubmitButton} from '@/components/ui/pending-submit-button'
import type {SupportedUiLocale} from '@/lib/locale-preferences'

const copy={
 nl:{create:'Algemene promotietaak aanmaken',intro:'Wijs promotiewerk toe zonder een evenement. Alleen goedgekeurde promotieleden met actieve toegang zijn beschikbaar.',title:'Taaknaam',description:'Omschrijving en publicatielinks',members:'Promotieleden',choose:'Selecteer één of meerdere promotieleden',empty:'Geen actieve promotieleden beschikbaar.',error:'De lijst met promotieleden kon niet volledig worden geladen. Probeer opnieuw.',save:'Taak aanmaken',edit:'Promotietaak bewerken',update:'Wijzigingen opslaan',assign:'Promotielid toevoegen',select:'Kies een promotielid',pending:'Opslaan…',editNote:'Open toewijzingen moeten na een wijziging opnieuw bevestigd worden.',saved:'Wijzigingen opgeslagen.',invalid:'Controleer de ingevulde taakgegevens.',failure:'Opslaan mislukt. Vernieuw de pagina en controleer of het promotielid nog toegang heeft.',conflict:'Deze taak werd ondertussen gewijzigd. Vernieuw de pagina voordat je opnieuw opslaat.'},
 fr:{create:'Créer une tâche promotionnelle générale',intro:'Attribuez du travail promotionnel sans événement. Seuls les membres approuvés disposant d’un accès actif sont disponibles.',title:'Nom de la tâche',description:'Description et liens de publication',members:'Membres promotionnels',choose:'Sélectionnez un ou plusieurs membres',empty:'Aucun membre promotionnel actif disponible.',error:'La liste complète des membres est indisponible. Réessayez.',save:'Créer la tâche',edit:'Modifier la tâche promotionnelle',update:'Enregistrer les modifications',assign:'Ajouter un membre',select:'Choisir un membre',pending:'Enregistrement…',editNote:'Après une modification, les affectations ouvertes doivent être confirmées à nouveau.',saved:'Modifications enregistrées.',invalid:'Vérifiez les données saisies.',failure:'Échec de l’enregistrement. Actualisez la page et vérifiez l’accès du membre.',conflict:'Cette tâche a été modifiée entre-temps. Actualisez la page avant de réessayer.'},
 en:{create:'Create general promotion task',intro:'Assign promotion work without an event. Only approved promotion members with active access are available.',title:'Task name',description:'Description and publication links',members:'Promotion members',choose:'Select one or more promotion members',empty:'No active promotion members available.',error:'The complete member list could not be loaded. Try again.',save:'Create task',edit:'Edit promotion task',update:'Save changes',assign:'Add promotion member',select:'Choose a promotion member',pending:'Saving…',editNote:'After an edit, open assignments must be confirmed again.',saved:'Changes saved.',invalid:'Check the task details you entered.',failure:'Could not save. Refresh the page and check that the member still has promotion access.',conflict:'This task changed in the meantime. Refresh the page before saving again.'},
 de:{create:'Allgemeine Promotionsaufgabe erstellen',intro:'Promotionsarbeit ohne Veranstaltung zuweisen. Verfügbar sind nur genehmigte Mitglieder mit aktivem Zugriff.',title:'Aufgabenname',description:'Beschreibung und Veröffentlichungslinks',members:'Promotionsmitglieder',choose:'Ein oder mehrere Mitglieder auswählen',empty:'Keine aktiven Promotionsmitglieder verfügbar.',error:'Die vollständige Mitgliederliste konnte nicht geladen werden. Erneut versuchen.',save:'Aufgabe erstellen',edit:'Promotionsaufgabe bearbeiten',update:'Änderungen speichern',assign:'Promotionsmitglied hinzufügen',select:'Promotionsmitglied auswählen',pending:'Speichern…',editNote:'Nach einer Änderung müssen offene Zuweisungen erneut bestätigt werden.',saved:'Änderungen gespeichert.',invalid:'Prüfe die eingegebenen Aufgabendaten.',failure:'Speichern fehlgeschlagen. Seite neu laden und Zugriff des Mitglieds prüfen.',conflict:'Diese Aufgabe wurde zwischenzeitlich geändert. Lade die Seite vor dem Speichern neu.'}
} as const
export type PromotionMember={user_id:string;full_name:string|null}
type ReturnState={adminView:boolean;q:string;scope:string;page:number}
function ReturnFields({state}:{state:ReturnState}){
 return <><input type="hidden" name="admin_view" value={state.adminView?'1':'0'}/><input type="hidden" name="return_q" value={state.q}/><input type="hidden" name="return_scope" value={state.scope}/><input type="hidden" name="return_page" value={state.page}/></>
}
export function PromotionTaskFeedback({locale,error,saved}:{locale:SupportedUiLocale;error?:string;saved?:string}){
 const t=copy[locale]
 return error?<p role="alert" className="rounded-xl border border-amber-500 p-3">{error==='conflict'?t.conflict:error==='invalid'?t.invalid:t.failure}</p>:saved==='1'?<p role="status" className="rounded-xl border p-3">{t.saved}</p>:null
}
export function GeneralPromotionTaskCreate({locale,members,incomplete,state}:{locale:SupportedUiLocale;members:PromotionMember[];incomplete:boolean;state:ReturnState}){
 const t=copy[locale]
 return <section className="space-y-3 rounded-xl border bg-card p-4" aria-label={t.create}>
  <h2 className="font-semibold">{t.create}</h2><p className="text-sm text-muted-foreground">{t.intro}</p>
  {incomplete?<p role="alert">{t.error}</p>:!members.length?<p className="text-sm text-muted-foreground">{t.empty}</p>:<form action={createPromotionTask} className="grid gap-3">
   <ReturnFields state={{...state,scope:'general',q:'',page:1}}/><input type="hidden" name="request" value={randomUUID()}/>
   <label className="grid gap-1 text-sm">{t.title}<input name="title" required maxLength={200} className="rounded-lg border bg-background p-2"/></label>
   <label className="grid gap-1 text-sm">{t.description}<textarea name="description" maxLength={4000} rows={4} className="rounded-lg border bg-background p-2"/></label>
   <label className="grid gap-1 text-sm">{t.members}<span className="text-xs text-muted-foreground">{t.choose}</span><select name="user_id" required multiple size={Math.min(8,Math.max(3,members.length))} className="rounded-lg border bg-background p-2">{members.map(member=><option key={member.user_id} value={member.user_id}>{member.full_name||member.user_id}</option>)}</select></label>
   <PendingSubmitButton pendingLabel={t.pending} className="rounded-lg border border-violet-500 p-3 font-semibold">{t.save}</PendingSubmitButton>
  </form>}
 </section>
}
export function GeneralPromotionTaskControls({locale,task,members,incomplete,assigned,state}:{locale:SupportedUiLocale;task:{id:string;title:string;description:string|null;updated_at:string};members:PromotionMember[];incomplete:boolean;assigned:string[];state:ReturnState}){
 const t=copy[locale],eligible=members.filter(member=>!assigned.includes(member.user_id))
 return <div className="mt-3 space-y-3">
  <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-semibold">{t.edit}</summary>
   <form action={editPromotionTask} className="mt-3 grid gap-2"><ReturnFields state={state}/><input type="hidden" name="task_id" value={task.id}/><input type="hidden" name="expected_updated_at" value={task.updated_at}/>
    <label className="grid gap-1 text-sm">{t.title}<input name="title" required maxLength={200} defaultValue={task.title} className="rounded-lg border bg-background p-2"/></label>
    <label className="grid gap-1 text-sm">{t.description}<textarea name="description" maxLength={4000} defaultValue={task.description??''} rows={4} className="rounded-lg border bg-background p-2"/></label>
    <p className="text-xs text-muted-foreground">{t.editNote}</p><PendingSubmitButton pendingLabel={t.pending} className="rounded-lg border p-2">{t.update}</PendingSubmitButton>
   </form>
  </details>
  {!incomplete&&eligible.length>0&&<form action={assignGeneralPromotionTask} className="flex flex-wrap items-end gap-2"><ReturnFields state={state}/><input type="hidden" name="task_id" value={task.id}/>
   <label className="grid min-w-0 flex-1 gap-1 text-sm">{t.select}<select name="user_id" required defaultValue="" className="rounded-lg border bg-background p-2"><option value="" disabled>{t.select}</option>{eligible.map(member=><option key={member.user_id} value={member.user_id}>{member.full_name||member.user_id}</option>)}</select></label>
   <PendingSubmitButton pendingLabel={t.pending} className="rounded-lg border px-3 py-2 text-sm">{t.assign}</PendingSubmitButton>
  </form>}
 </div>
}
