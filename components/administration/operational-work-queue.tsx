import type {SupabaseClient} from '@supabase/supabase-js'
import {redirect} from 'next/navigation'
import {revalidatePath} from 'next/cache'
import {administrationAccess} from '@/lib/administration/access'
import {administrationDeadline} from '@/lib/administration/deadline'
import type {SupportedUiLocale} from '@/lib/locale-preferences'

const copy={
 nl:{title:'Dossiers en deadlines',name:'Titel',details:'Toelichting',deadline:'Deadline (Belgische datum)',event:'Evenement',none:'Zonder evenement',save:'Wijzigingen opslaan',edit:'Dossier bewerken',create:'Dossier aanmaken',submit:'Voorleggen aan Admin',approve:'Goedkeuren',reject:'Afwijzen',complete:'Afhandelen',reason:'Reden bij afwijzing',empty:'Nog geen dossiers',error:'Dossiers konden niet worden geladen.',open:'Open',submitted:'Ter goedkeuring',approved:'Goedgekeurd',rejected:'Afgewezen',completed:'Afgehandeld',cancelled:'Geannuleerd',intro:'Leg afspraken en verplichtingen vast. Een Admin beslist over goedkeuring; na goedkeuring kan Administratie het dossier afhandelen.'},
 fr:{title:'Dossiers et échéances',name:'Titre',details:'Détails',deadline:'Échéance (date belge)',event:'Événement',none:'Sans événement',save:'Enregistrer les modifications',edit:'Modifier le dossier',create:'Créer un dossier',submit:'Soumettre à l’Admin',approve:'Approuver',reject:'Refuser',complete:'Terminer',reason:'Motif du refus',empty:'Aucun dossier',error:'Impossible de charger les dossiers.',open:'Ouvert',submitted:'À approuver',approved:'Approuvé',rejected:'Refusé',completed:'Terminé',cancelled:'Annulé',intro:'Enregistrez les accords et obligations. Un Admin approuve le dossier; l’Administration peut ensuite le terminer.'},
 en:{title:'Cases and deadlines',name:'Title',details:'Details',deadline:'Deadline (Belgian date)',event:'Event',none:'No event',save:'Save changes',edit:'Edit case',create:'Create case',submit:'Submit to Admin',approve:'Approve',reject:'Reject',complete:'Complete',reason:'Rejection reason',empty:'No cases yet',error:'Unable to load cases.',open:'Open',submitted:'Awaiting approval',approved:'Approved',rejected:'Rejected',completed:'Completed',cancelled:'Cancelled',intro:'Record agreements and obligations. An Admin approves the case; Administration can then complete it.'},
 de:{title:'Vorgänge und Fristen',name:'Titel',details:'Details',deadline:'Frist (belgisches Datum)',event:'Veranstaltung',none:'Ohne Veranstaltung',save:'Änderungen speichern',edit:'Vorgang bearbeiten',create:'Vorgang erstellen',submit:'Admin vorlegen',approve:'Genehmigen',reject:'Ablehnen',complete:'Abschließen',reason:'Ablehnungsgrund',empty:'Noch keine Vorgänge',error:'Vorgänge konnten nicht geladen werden.',open:'Offen',submitted:'Zur Freigabe',approved:'Genehmigt',rejected:'Abgelehnt',completed:'Abgeschlossen',cancelled:'Storniert',intro:'Vereinbarungen und Pflichten erfassen. Ein Admin genehmigt den Vorgang; anschließend kann die Verwaltung ihn abschließen.'},
} as const
type Kind='logistics'|'permits'|'tasks'
async function saveCase(form:FormData){
 'use server'
 const access=await administrationAccess()
 if(!access.ok)redirect('/portals')
 const kind=String(form.get('kind')) as Kind
 if(!['logistics','permits','tasks'].includes(kind))throw Error('Invalid case type')
 const db=access.db as unknown as SupabaseClient
 const action=String(form.get('action')??'create'),id=String(form.get('id')??'')
 if(action==='create'){
  const title=String(form.get('title')??'').trim(),details=String(form.get('details')??'').trim(),event=String(form.get('event')??'')
  if(title.length<3||title.length>180||details.length>4000||event&&!/^[0-9a-f-]{36}$/i.test(event))throw Error('Invalid case')
  const due=administrationDeadline(String(form.get('deadline')??''))
  const {error}=await db.from('admin_operational_obligations').insert({kind,title,details,event_id:event||null,due_at:due,created_by:access.user.id})
  if(error)throw Error('Case could not be saved')
 }else if(action==='edit'){
  const title=String(form.get('title')??'').trim(),details=String(form.get('details')??'').trim(),status=String(form.get('status')??'')
  if(!/^[0-9a-f-]{36}$/i.test(id)||!['open','rejected'].includes(status)||title.length<3||title.length>180||details.length>4000)throw Error('Invalid case edit')
  const due=administrationDeadline(String(form.get('deadline')??''))
  const {data,error}=await db.from('admin_operational_obligations').update({title,details,due_at:due}).eq('id',id).eq('kind',kind).eq('status',status).eq('updated_at',String(form.get('updated_at')??'')).select('id')
  if(error||data?.length!==1)throw Error('Case changed; reload before retrying')
 }else{
  if(!/^[0-9a-f-]{36}$/i.test(id)||!['submitted','approved','rejected','completed'].includes(action))throw Error('Invalid case transition')
  if(['approved','rejected'].includes(action)&&!access.user.realIsAdmin)throw Error('Admin required')
  const status=String(form.get('status')??''),note=String(form.get('note')??'').trim()
  if(note.length>2000||(action==='rejected'&&note.length<3))throw Error('Rejection reason required')
  const {data,error}=await db.from('admin_operational_obligations').update(action==='rejected'?{status:action,review_note:note}:{status:action}).eq('id',id).eq('kind',kind).eq('status',status).eq('updated_at',String(form.get('updated_at')??'')).select('id')
  if(error||data?.length!==1)throw Error('Case changed; reload before retrying')
 }
 revalidatePath('/portals/administration/modules/'+kind)
}
export default async function OperationalWorkQueue({kind,locale,events}:{kind:Kind;locale:SupportedUiLocale;events:{id:string;name:string}[]}){
 const access=await administrationAccess()
 if(!access.ok)return null
 const t=copy[locale]
 const {data,error}=await (access.db as unknown as SupabaseClient).from('admin_operational_obligations').select('id,title,details,due_at,status,review_note,created_by,updated_at').eq('kind',kind).order('due_at').limit(100)
 return <section id="administration-work-queue" className="space-y-4 rounded-2xl border bg-card p-5"><h2 className="text-lg font-semibold">{t.title}</h2><p className="text-sm text-muted-foreground">{t.intro}</p>
  <form action={saveCase} className="grid gap-3 sm:grid-cols-2"><input type="hidden" name="kind" value={kind}/>
   <label className="grid gap-1 text-sm">{t.name}<input required name="title" minLength={3} maxLength={180} className="rounded-lg border bg-background p-2"/></label>
   <label className="grid gap-1 text-sm">{t.deadline}<input required type="date" name="deadline" className="rounded-lg border bg-background p-2"/></label>
   <label className="grid gap-1 text-sm">{t.event}<select name="event" className="rounded-lg border bg-background p-2"><option value="">{t.none}</option>{events.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
   <label className="grid gap-1 text-sm">{t.details}<textarea name="details" maxLength={4000} className="rounded-lg border bg-background p-2"/></label>
   <button className="rounded-lg bg-violet-600 px-4 py-2 font-semibold text-white">{t.create}</button>
  </form>
  {error?<p role="alert">{t.error}</p>:!data?.length?<p className="text-sm">{t.empty}</p>:<div className="space-y-3">{data.map(row=><article key={row.id} className="rounded-xl border p-3"><div className="flex justify-between gap-2"><strong>{row.title}</strong><span className="text-sm">{t[row.status as keyof typeof t]??row.status}</span></div><p className="mt-1 whitespace-pre-wrap text-sm">{row.details}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(row.due_at).toLocaleDateString(locale,{timeZone:'Europe/Brussels'})}</p>{row.review_note&&<p className="mt-2 text-sm">{row.review_note}</p>}
   {['open','rejected'].includes(row.status)&&<details className="mt-3"><summary className="cursor-pointer text-sm text-violet-400">{t.edit}</summary><form action={saveCase} className="mt-2 grid gap-2"><input type="hidden" name="id" value={row.id}/><input type="hidden" name="kind" value={kind}/><input type="hidden" name="status" value={row.status}/><input type="hidden" name="updated_at" value={row.updated_at}/><label className="grid gap-1 text-sm">{t.name}<input required name="title" minLength={3} maxLength={180} defaultValue={row.title} className="rounded-lg border bg-background p-2"/></label><label className="grid gap-1 text-sm">{t.deadline}<input required type="date" name="deadline" defaultValue={new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Brussels',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(row.due_at))} className="rounded-lg border bg-background p-2"/></label><label className="grid gap-1 text-sm">{t.details}<textarea name="details" maxLength={4000} defaultValue={row.details} className="rounded-lg border bg-background p-2"/></label><button name="action" value="edit" className="rounded-lg border px-3 py-2 text-sm">{t.save}</button></form></details>}
   <form action={saveCase} className="mt-3 flex flex-wrap gap-2"><input type="hidden" name="id" value={row.id}/><input type="hidden" name="kind" value={kind}/><input type="hidden" name="status" value={row.status}/><input type="hidden" name="updated_at" value={row.updated_at}/>
    {['open','rejected'].includes(row.status)&&<button name="action" value="submitted" className="rounded-lg border px-3 py-2 text-sm">{t.submit}</button>}
    {row.status==='submitted'&&access.user.realIsAdmin&&<><input name="note" maxLength={2000} placeholder={t.reason} className="min-w-40 rounded-lg border bg-background p-2 text-sm"/><button name="action" value="approved" className="rounded-lg border px-3 py-2 text-sm">{t.approve}</button><button name="action" value="rejected" className="rounded-lg border px-3 py-2 text-sm">{t.reject}</button></>}
    {row.status==='approved'&&<button name="action" value="completed" className="rounded-lg border px-3 py-2 text-sm">{t.complete}</button>}
   </form>
  </article>)}</div>}
 </section>
}
