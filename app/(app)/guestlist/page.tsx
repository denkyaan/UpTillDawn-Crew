import {redirect} from 'next/navigation'
import {getCurrentUser} from '@/lib/actions/auth'
import {createClient} from '@/lib/supabase/crew-server'
import {addGuestlistEntry,setBackstageWorkplace} from '@/lib/actions/guestlist'
import {GuestlistEntranceClient,type GuestlistEntry} from '@/components/crew/guestlist-entrance-client'
import {BackstageArtistChecklist,type ArtistChecklistRow} from '@/components/crew/backstage-artist-checklist'
import {GuestlistImportForm} from '@/components/crew/guestlist-import-form'
import {PlatformAiAssistant} from '@/components/admin/platform-ai-assistant'

export const dynamic='force-dynamic'

type EventRow={id:string;name:string;status:string;start_at:string;end_at:string}

export default async function GuestlistPage({
  searchParams,
}:{
  searchParams:Promise<{event?:string}>
}){
  const current=await getCurrentUser()
  if(!current)redirect('/login')
  const s=await createClient()
  const params=await searchParams
  const isAdmin=current.isAdmin===true

  let events:EventRow[]=[]
  let ownShifts:Array<{event_id:string;scheduled_start:string;scheduled_end:string;status:string;response_status:string}>=[]
  let ownResponsible:Array<{event_id:string}>=[]

  if(isAdmin){
    const {data,error}=await s.from('events').select('id,name,status,start_at,end_at').neq('status','archived').order('start_at')
    if(error)throw new Error('Evenementen konden niet worden geladen.')
    events=(data||[]) as EventRow[]
  }else{
    const [shiftResult,responsibleResult,memberResult]=await Promise.all([
      s.from('shifts').select('event_id,scheduled_start,scheduled_end,status,response_status').eq('user_id',current.id).neq('status','cancelled').neq('response_status','declined'),
      s.from('responsible_assignments').select('event_id').eq('user_id',current.id),
      s.from('event_members').select('event_id').eq('user_id',current.id),
    ])
    ownShifts=(shiftResult.data||[]) as typeof ownShifts
    ownResponsible=(responsibleResult.data||[]) as typeof ownResponsible
    const ids=[...new Set([
      ...ownShifts.map(row=>row.event_id),
      ...ownResponsible.map(row=>row.event_id),
      ...(memberResult.data||[]).map(row=>row.event_id),
    ])]
    if(ids.length){
      const {data,error}=await s.from('events').select('id,name,status,start_at,end_at').in('id',ids).neq('status','archived').order('start_at')
      if(error)throw new Error('Evenementen konden niet worden geladen.')
      events=(data||[]) as EventRow[]
    }
  }

  const selected=events.find(event=>event.id===params.event)||events[0]||null
  if(!selected){
    return <main className="space-y-4 p-4 pb-28 md:p-8">
      <h1 className="text-3xl font-black">Inkom & Guestlist</h1>
      <p className="rounded-2xl border p-4 text-muted-foreground">Geen toegewezen evenement met guestlist beschikbaar.</p>
    </main>
  }

  const now=new Date().getTime()
  const canCheckIn=isAdmin
    || ownResponsible.some(row=>row.event_id===selected.id)
    || ownShifts.some(row=>row.event_id===selected.id&&Date.parse(row.scheduled_start)<=now&&Date.parse(row.scheduled_end)>=now)

  const [entriesResult,checklistResult]=await Promise.all([
    s.from('event_guestlist_entries')
      .select('id,event_id,name,entry_type,spots_total,spots_checked_in,notes,source,source_document_name,last_checked_in_at,arrival_notified_at')
      .eq('event_id',selected.id)
      .eq('is_active',true)
      .order('entry_type')
      .order('name'),
    s.from('artist_backstage_checklists')
      .select('guestlist_entry_id,event_id,drinks,hospitality_notes,drinks_ready,artist_received,drinks_ready_at,artist_received_at')
      .eq('event_id',selected.id),
  ])

  if(entriesResult.error)throw new Error('Guestlist kon niet worden geladen.')
  const entries=(entriesResult.data||[]) as GuestlistEntry[]
  const checklist=(checklistResult.data||[]) as ArtistChecklistRow[]
  const artists=entries.filter(entry=>entry.entry_type==='artist').map(entry=>({
    id:entry.id,
    name:entry.name,
    spots_checked_in:entry.spots_checked_in,
  }))

  let workplaces:Array<{id:string;name:string}>=[]
  let backstageWorkplaceId=''
  if(isAdmin){
    const [workplaceResult,settingsResult]=await Promise.all([
      s.from('workplaces').select('id,name').eq('event_id',selected.id).eq('is_active',true).order('name'),
      s.from('event_guestlist_settings').select('backstage_workplace_id').eq('event_id',selected.id).maybeSingle(),
    ])
    workplaces=workplaceResult.data||[]
    backstageWorkplaceId=settingsResult.data?.backstage_workplace_id||''
  }

  return <main className="mx-auto max-w-6xl space-y-6 p-4 pb-28 md:p-8">
    <header className="space-y-3">
      <div>
        <p className="text-xs font-black uppercase tracking-[.2em] text-violet-400">INKOM</p>
        <h1 className="text-3xl font-black">Inkom & Guestlist</h1>
        <p className="mt-1 text-sm text-muted-foreground">Zoek guests en artiesten snel op, registreer aankomst en stuur artiesten realtime door naar backstage.</p>
      </div>
      <form method="get" className="flex flex-col gap-2 sm:flex-row">
        <select name="event" defaultValue={selected.id} className="min-w-0 flex-1 rounded-xl border bg-background p-3">
          {events.map(event=><option key={event.id} value={event.id}>{event.name}</option>)}
        </select>
        <button className="rounded-xl border px-4 py-3 font-bold">EVENEMENT OPENEN</button>
      </form>
    </header>

    {isAdmin&&<section className="grid gap-4 lg:grid-cols-2">
      <article className="space-y-3 rounded-2xl border p-4">
        <h2 className="text-xl font-black">Guest of artiest toevoegen</h2>
        <form action={addGuestlistEntry} className="grid gap-2 sm:grid-cols-2">
          <input type="hidden" name="event_id" value={selected.id}/>
          <input name="name" required maxLength={240} placeholder="Naam" className="rounded-lg border bg-background p-3"/>
          <select name="entry_type" defaultValue="guest" className="rounded-lg border bg-background p-3">
            <option value="guest">Guest</option>
            <option value="artist">Artiest</option>
          </select>
          <input name="spots" type="number" min="1" max="100" defaultValue="1" required aria-label="Guest spots" className="rounded-lg border bg-background p-3"/>
          <input name="notes" maxLength={2000} placeholder="Notitie (optioneel)" className="rounded-lg border bg-background p-3"/>
          <button className="rounded-xl bg-violet-600 p-3 font-bold text-white sm:col-span-2">TOEVOEGEN AAN GUESTLIST</button>
        </form>
      </article>

      <article className="space-y-3 rounded-2xl border p-4">
        <h2 className="text-xl font-black">Guestlist uit bestand</h2>
        <GuestlistImportForm eventId={selected.id}/>
      </article>

      <article className="space-y-3 rounded-2xl border p-4 lg:col-span-2">
        <h2 className="text-xl font-black">Backstage koppeling</h2>
        <p className="text-sm text-muted-foreground">Bij de eerste check-in van een artiest krijgt de verantwoordelijke van deze werkplek direct: “Artiest - naam, is aangekomen.” Dezelfde tekst wordt in de backstagechat geplaatst.</p>
        <form action={setBackstageWorkplace} className="flex flex-col gap-2 sm:flex-row">
          <input type="hidden" name="event_id" value={selected.id}/>
          <select name="workplace_id" required defaultValue={backstageWorkplaceId} className="min-w-0 flex-1 rounded-xl border bg-background p-3">
            <option value="">Backstage werkplek kiezen…</option>
            {workplaces.map(workplace=><option key={workplace.id} value={workplace.id}>{workplace.name}</option>)}
          </select>
          <button className="rounded-xl border px-4 py-3 font-bold">BACKSTAGE INSTELLEN</button>
        </form>
      </article>
    </section>}

    {isAdmin&&<PlatformAiAssistant/>}

    <GuestlistEntranceClient
      key={selected.id}
      eventId={selected.id}
      initialEntries={entries}
      canCheckIn={canCheckIn}
      canManage={isAdmin}
    />

    {(isAdmin||checklist.length>0)&&<BackstageArtistChecklist
      key={'backstage-'+selected.id}
      eventId={selected.id}
      artists={artists}
      initialRows={checklist}
      canManageHospitality={isAdmin}
    />}
  </main>
}
