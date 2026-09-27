import { createClient } from '@/lib/supabase/crew-server'
import { archiveEventDocument, createEventDocument } from '@/lib/actions/uptilldawn'
import { shouldCacheDocumentOffline, type EventDocumentKind } from '@/lib/document-access'
import type { Tables } from '@/types/crew-database'

export type EventDocumentWorkplaceOption={
  id:string
  label:string
}

function kindLabel(kind:string){
  if(kind==='briefing')return 'BRIEFING'
  if(kind==='safety')return 'VEILIGHEID'
  if(kind==='map')return 'PLAN / KAART'
  if(kind==='procedure')return 'PROCEDURE'
  if(kind==='permit')return 'VERGUNNING'
  if(kind==='technical')return 'TECHNISCH'
  return 'CREW'
}
function audienceLabel(audience:string){
  if(audience==='admin')return 'ADMIN'
  if(audience==='responsible')return 'RESPONSIBLE + ADMIN'
  return 'CREW'
}
function formatBytes(bytes:number){
  if(bytes<1024)return bytes+' B'
  if(bytes<1024*1024)return Math.round(bytes/1024)+' KB'
  return (bytes/(1024*1024)).toFixed(1)+' MB'
}

export async function EventDocumentsPanel({
  eventId,
  canManage,
  allowEventWide,
  workplaceOptions,
}:{
  eventId:string
  canManage:boolean
  allowEventWide:boolean
  workplaceOptions:EventDocumentWorkplaceOption[]
}){
  const s=await createClient()
  const {data,error}=await s
    .from('event_documents')
    .select('*')
    .eq('event_id',eventId)
    .eq('is_active',true)
    .order('offline_critical',{ascending:false})
    .order('created_at',{ascending:false})

  if(error)return <section className="rounded-2xl border p-4">
    <h2 className="text-xl font-black">Documenten</h2>
    <p className="mt-2 text-sm text-muted-foreground">Documenten konden niet worden geladen.</p>
  </section>

  const documents=(data||[]) as Tables<'event_documents'>[]
  const workplaceById=new Map(workplaceOptions.map(item=>[item.id,item.label]))
  const signedUrls=new Map<string,string>()
  await Promise.all(documents.map(async document=>{
    const {data:signed}=await s.storage.from('work-media').createSignedUrl(document.storage_path,600)
    if(signed?.signedUrl)signedUrls.set(document.id,signed.signedUrl)
  }))

  return <section className="space-y-4 rounded-2xl border p-4">
    <div>
      <h2 className="text-xl font-black">Documenten</h2>
      <p className="text-sm text-muted-foreground">Veiligheid, plannen, procedures, vergunningen en technische bestanden volgens rol en werkplek.</p>
    </div>

    {canManage&&<details className="rounded-xl border p-3">
      <summary className="cursor-pointer font-semibold">Document toevoegen</summary>
      <form action={createEventDocument} className="mt-3 grid gap-2 md:grid-cols-2">
        <input type="hidden" name="event_id" value={eventId}/>
        <select name="workplace_id" required={!allowEventWide} className="rounded-lg border bg-background p-3">
          {allowEventWide&&<option value="">Hele evenement</option>}
          {!allowEventWide&&<option value="">Werkplek…</option>}
          {workplaceOptions.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
        <select name="kind" defaultValue="safety" className="rounded-lg border bg-background p-3">
          <option value="briefing">Briefing</option>
          <option value="safety">Veiligheid</option>
          <option value="map">Plan / kaart</option>
          <option value="procedure">Procedure</option>
          <option value="permit">Vergunning</option>
          <option value="technical">Technisch</option>
          <option value="crew">Crew</option>
        </select>
        <select name="audience" defaultValue="employee" className="rounded-lg border bg-background p-3">
          <option value="employee">Alle toegewezen crew</option>
          <option value="responsible">Responsible + Admin</option>
          <option value="admin">Alleen Admin</option>
        </select>
        <input name="title" required maxLength={200} placeholder="Documentnaam" className="rounded-lg border bg-background p-3"/>
        <textarea name="description" maxLength={2000} placeholder="Omschrijving (optioneel)" className="rounded-lg border bg-background p-3 md:col-span-2"/>
        <input name="document" type="file" required accept=".pdf,.docx,.pptx,.xlsx,.txt,.csv,.jpg,.jpeg,.png,.webp,application/pdf,text/plain,text/csv,image/jpeg,image/png,image/webp" className="rounded-lg border bg-background p-3 md:col-span-2"/>
        <label className="flex items-start gap-2 rounded-lg border p-3 text-sm md:col-span-2">
          <input name="offline_critical" type="checkbox"/>
          <span><b>Offline belangrijk</b><br/><span className="text-muted-foreground">Dit bestand wordt op het toestel lokaal bewaard zodra de gebruiker het online mag openen.</span></span>
        </label>
        <button className="rounded-lg bg-violet-600 p-3 font-bold text-white md:col-span-2">DOCUMENT TOEVOEGEN</button>
      </form>
    </details>}

    {!documents.length
      ? <p className="rounded-xl border p-4 text-sm text-muted-foreground">Geen toegankelijke documenten voor dit evenement.</p>
      : <div className="grid gap-3">{documents.map(document=>{
          const url=signedUrls.get(document.id)
          const model={audiences:[document.audience==='employee'?'employee':document.audience==='responsible'?'responsible':'admin'] as const,eventId:document.event_id,workplaceId:document.workplace_id,offlineCritical:document.offline_critical}
          const offlineCritical=shouldCacheDocumentOffline(model)
          return <article key={document.id} className="rounded-xl border p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold">{document.title}</h3>
                  <span className="rounded-full border px-2 py-1 text-xs font-black">{kindLabel(document.kind as EventDocumentKind)}</span>
                  {offlineCritical&&<span className="rounded-full border border-amber-500/50 px-2 py-1 text-xs font-black text-amber-600">OFFLINE BELANGRIJK</span>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {document.workplace_id?(workplaceById.get(document.workplace_id)||'Werkplek'):'Hele evenement'} · {audienceLabel(document.audience)}
                </p>
                {document.description&&<p className="mt-2 whitespace-pre-wrap text-sm">{document.description}</p>}
                <p className="mt-2 text-xs text-muted-foreground">{document.file_name} · {formatBytes(Number(document.file_size_bytes))}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {url&&<a href={url} target="_blank" rel="noreferrer" className="rounded-lg border px-3 py-2 text-sm font-bold">OPENEN</a>}
                {canManage&&<form action={archiveEventDocument}>
                  <input type="hidden" name="document_id" value={document.id}/>
                  <button className="rounded-lg border border-red-500/40 px-3 py-2 text-sm font-bold text-red-600">VERWIJDEREN</button>
                </form>}
              </div>
            </div>
          </article>
        })}</div>}
  </section>
}
