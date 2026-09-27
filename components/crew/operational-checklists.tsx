import { createClient } from '@/lib/supabase/crew-server'
import {
  addOperationalChecklistItem,
  closeOperationalChecklist,
  completeOperationalChecklistItem,
  createOperationalChecklist,
  removeOperationalChecklistItem,
  reopenOperationalChecklist,
  reopenOperationalChecklistItem,
} from '@/lib/actions/uptilldawn'
import {
  checklistCanClose,
  checklistCompletionRate,
  type ChecklistKind,
  type OperationalChecklist,
} from '@/lib/checklists'

export type ChecklistWorkplaceOption={
  id:string
  eventId:string
  label:string
}

function kindLabel(kind:string){
  if(kind==='opening')return 'OPENING'
  if(kind==='closing')return 'SLUITING'
  if(kind==='safety')return 'VEILIGHEID'
  return 'CUSTOM'
}

export async function OperationalChecklistPanel({
  userId,
  canManage,
  workplaceOptions,
}:{
  userId:string
  canManage:boolean
  workplaceOptions:ChecklistWorkplaceOption[]
}){
  const s=await createClient()
  const {data:checklists,error}=await s
    .from('operational_checklists')
    .select('id,event_id,workplace_id,kind,title,description,status,completed_at,created_at,events(name),workplaces(name)')
    .order('created_at',{ascending:false})

  if(error){
    return <section className="rounded-2xl border p-4">
      <h2 className="text-xl font-black">Operationele checklists</h2>
      <p className="mt-2 text-sm text-muted-foreground">Checklists konden niet worden geladen.</p>
    </section>
  }

  const checklistIds=(checklists||[]).map(row=>row.id)
  const {data:items,error:itemError}=checklistIds.length
    ? await s
        .from('checklist_items')
        .select('id,checklist_id,label,required,requires_photo,sort_order,completed_at,completed_by,photo_path')
        .in('checklist_id',checklistIds)
        .order('sort_order')
    : {data:[],error:null}

  if(itemError){
    return <section className="rounded-2xl border p-4">
      <h2 className="text-xl font-black">Operationele checklists</h2>
      <p className="mt-2 text-sm text-muted-foreground">Checklistpunten konden niet worden geladen.</p>
    </section>
  }

  const photoUrls=new Map<string,string>()
  await Promise.all((items||[]).filter(item=>item.photo_path).map(async item=>{
    const path=item.photo_path
    if(!path)return
    const {data}=await s.storage.from('work-media').createSignedUrl(path,300)
    if(data?.signedUrl)photoUrls.set(path,data.signedUrl)
  }))

  return <section className="space-y-4 rounded-2xl border p-4">
    <div>
      <h2 className="text-xl font-black">Operationele checklists</h2>
      <p className="text-sm text-muted-foreground">Opening, sluiting en veiligheid per werkplek. Verplichte punten blokkeren afsluiten totdat ze volledig zijn uitgevoerd.</p>
    </div>

    {canManage&&workplaceOptions.length>0&&<details className="rounded-xl border p-3">
      <summary className="cursor-pointer font-semibold">Nieuwe checklist</summary>
      <form action={createOperationalChecklist} className="mt-3 grid gap-2 md:grid-cols-2">
        <select name="workplace_id" required className="rounded-lg border bg-background p-3">
          <option value="">Werkplek…</option>
          {workplaceOptions.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
        <select name="kind" defaultValue="opening" className="rounded-lg border bg-background p-3">
          <option value="opening">Opening</option>
          <option value="closing">Sluiting</option>
          <option value="safety">Veiligheid</option>
          <option value="custom">Custom</option>
        </select>
        <input name="title" required maxLength={200} placeholder="Checklistnaam" className="rounded-lg border bg-background p-3"/>
        <textarea name="description" maxLength={2000} placeholder="Omschrijving (optioneel)" className="rounded-lg border bg-background p-3"/>
        <button className="rounded-lg bg-violet-600 p-3 font-bold text-white md:col-span-2">CHECKLIST AANMAKEN</button>
      </form>
    </details>}

    {!(checklists||[]).length
      ? <p className="rounded-xl border p-4 text-sm text-muted-foreground">Nog geen operationele checklists.</p>
      : <div className="grid gap-4">{(checklists||[]).map(checklist=>{
          const checklistItems=(items||[]).filter(item=>item.checklist_id===checklist.id)
          const model:OperationalChecklist={
            id:checklist.id,
            kind:(['opening','closing','safety','custom'].includes(checklist.kind)?checklist.kind:'custom') as ChecklistKind,
            items:checklistItems.map(item=>({
              id:item.id,
              label:item.label,
              required:item.required,
              requiresPhoto:item.requires_photo,
              completedAt:item.completed_at?Date.parse(item.completed_at):null,
              photoAttached:Boolean(item.photo_path),
            })),
          }
          const completion=Math.round(checklistCompletionRate(model)*100)
          const closeReady=checklistItems.length>0&&checklistCanClose(model)
          const completed=checklist.status==='completed'

          return <article key={checklist.id} className="space-y-3 rounded-xl border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold">{checklist.title}</h3>
                  <span className="rounded-full border px-2 py-1 text-xs font-black">{kindLabel(checklist.kind)}</span>
                </div>
                <p className="text-sm text-muted-foreground">{checklist.events?.name||'Evenement'} · {checklist.workplaces?.name||'Werkplek'}</p>
                {checklist.description&&<p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{checklist.description}</p>}
              </div>
              <div className="text-right">
                <span className={`rounded-full border px-3 py-1 text-xs font-black ${completed?'border-emerald-500/50 text-emerald-600':'border-amber-500/50 text-amber-600'}`}>
                  {completed?'AFGEROND':'OPEN'}
                </span>
                <p className="mt-2 text-xs text-muted-foreground">{checklistItems.filter(item=>item.completed_at).length}/{checklistItems.length} · {completion}%</p>
              </div>
            </div>

            <div className="space-y-2">
              {checklistItems.map(item=>{
                const done=Boolean(item.completed_at)
                const canReopen=canManage||item.completed_by===userId
                const photoUrl=item.photo_path?photoUrls.get(item.photo_path):null
                return <div key={item.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className={done?'font-semibold line-through opacity-70':'font-semibold'}>{item.label}</p>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {item.required&&<span>VERPLICHT</span>}
                        {item.requires_photo&&<span>FOTO VERPLICHT</span>}
                        {done&&item.completed_at&&<span>Voltooid {new Date(item.completed_at).toLocaleString('nl-BE')}</span>}
                      </div>
                    </div>
                    {done&&<span className="rounded-full border border-emerald-500/50 px-2 py-1 text-xs font-black text-emerald-600">KLAAR</span>}
                  </div>

                  {photoUrl&&<a href={photoUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold underline">Bekijk bewijsfoto</a>}

                  {!completed&&!done&&<form action={completeOperationalChecklistItem} className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <input type="hidden" name="item_id" value={item.id}/>
                    {item.requires_photo
                      ? <input name="photo" type="file" required accept="image/jpeg,image/png,image/webp" className="rounded-lg border bg-background p-2"/>
                      : <span className="self-center text-xs text-muted-foreground">Geen foto vereist.</span>}
                    <button className="rounded-lg bg-emerald-600 px-4 py-3 font-bold text-white">PUNT VOLTOOIEN</button>
                  </form>}

                  {!completed&&done&&canReopen&&<form action={reopenOperationalChecklistItem} className="mt-3">
                    <input type="hidden" name="item_id" value={item.id}/>
                    <button className="rounded-lg border px-3 py-2 text-sm font-bold">PUNT HEROPENEN</button>
                  </form>}

                  {!completed&&canManage&&<form action={removeOperationalChecklistItem} className="mt-2">
                    <input type="hidden" name="item_id" value={item.id}/>
                    <button className="text-xs font-semibold text-red-600 underline">Punt verwijderen</button>
                  </form>}
                </div>
              })}
            </div>

            {!completed&&canManage&&<form action={addOperationalChecklistItem} className="grid gap-2 rounded-lg border p-3 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
              <input type="hidden" name="checklist_id" value={checklist.id}/>
              <input name="label" required maxLength={300} placeholder="Nieuw checklistpunt" className="rounded-lg border bg-background p-3"/>
              <label className="flex items-center gap-2 text-sm"><input name="required" type="checkbox" defaultChecked/> Verplicht</label>
              <label className="flex items-center gap-2 text-sm"><input name="requires_photo" type="checkbox"/> Foto</label>
              <button className="rounded-lg border px-4 py-3 font-bold">PUNT TOEVOEGEN</button>
            </form>}

            {canManage&&<div className="flex flex-wrap items-center gap-2 border-t pt-3">
              {!completed
                ? <form action={closeOperationalChecklist}>
                    <input type="hidden" name="checklist_id" value={checklist.id}/>
                    <button disabled={!closeReady} className="rounded-lg bg-violet-600 px-4 py-3 font-bold text-white disabled:opacity-40">CHECKLIST AFRONDEN</button>
                  </form>
                : <form action={reopenOperationalChecklist}>
                    <input type="hidden" name="checklist_id" value={checklist.id}/>
                    <button className="rounded-lg border px-4 py-3 font-bold">CHECKLIST HEROPENEN</button>
                  </form>}
              {!completed&&!closeReady&&<p className="text-xs text-muted-foreground">Voltooi alle verplichte punten en verplichte foto&apos;s voordat je afsluit.</p>}
            </div>}
          </article>
        })}</div>}
  </section>
}

