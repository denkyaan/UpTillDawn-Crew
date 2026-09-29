import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/crew-server'
import { DateInput } from '@/components/crew/date-input'
import { PlatformAiAssistant } from '@/components/admin/platform-ai-assistant'
import { platformModuleHelp } from '@/lib/ui-field-help'
import { AutomationManager } from '@/components/admin/automation-manager'
import {
  applyEventTemplate, applyPlanningRecommendation, captureEventTemplate, createKnowledgeArticle,
  createQrResource, dismissPlanningRecommendation, generateEventReport, generatePlanningRecommendations,
  savePayRate, setFeatureRollout, snapshotPlatformConfiguration, updateAssetMetadata, restorePlatformConfiguration,
} from '@/lib/actions/platform'

export const dynamic='force-dynamic'

type CommandCenter={
  event?:{id:string;name:string;status:string;startAt:string;endAt:string}
  workplaces?:Array<{
    id:string;name:string;minimumStaff:number;targetStaff:number;maximumStaff:number|null;activeStaff:number;
    openIncidents:number;openAlerts:number;lowInventory:number;
    responsibles:Array<{id:string;name:string|null}>
    activePeople:Array<{userId:string;name:string|null;status:string;startedAt:string}>
  }>
}

const input='rounded-xl border bg-background p-3'

export default async function PlatformCenter(){
  const current=await getCurrentUser()
  if(!current?.isAdmin)redirect('/')
  const s=await createClient()
  const now=new Date().toISOString()

  const [
    eventsResult,recommendationsResult,featuresResult,knowledgeResult,qrResult,templatesResult,
    versionsResult,profilesResult,workplacesResult,inventoryResult,reportsResult,recoveryResult,automationResult,
  ]=await Promise.all([
    s.from('events').select('id,name,status,start_at,end_at,venue,address').neq('status','archived').order('start_at'),
    s.from('planning_recommendations').select('id,event_id,workplace_id,recommended_user_id,role_name,scheduled_start,scheduled_end,score,reasons,status').eq('status','proposed').order('score',{ascending:false}).limit(100),
    s.from('feature_rollouts').select('*').order('feature_key'),
    s.from('knowledge_articles').select('id,event_id,workplace_id,category,title,offline_critical,is_published,updated_at').order('updated_at',{ascending:false}).limit(30),
    s.from('qr_resources').select('id,code,event_id,workplace_id,resource_type,title,route,active').order('created_at',{ascending:false}).limit(30),
    s.from('event_templates').select('id,name,source_event_id,sections,updated_at').order('updated_at',{ascending:false}).limit(30),
    s.from('configuration_versions').select('id,kind,note,created_at').order('created_at',{ascending:false}).limit(10),
    s.rpc('upt_admin_personnel_details_v2'),
    s.from('workplaces').select('id,event_id,name').eq('is_active',true).order('name'),
    s.from('inventory_items').select('id,event_id,workplace_id,name,asset_code,barcode,serial_number,location_label,maintenance_due_at,reorder_threshold,unit_cost_cents,asset_notes,available_quantity,total_quantity,missing_quantity,damaged_quantity').eq('is_active',true).order('name').limit(200),
    s.from('event_report_snapshots').select('id,event_id,snapshot,generated_at,generation_kind').order('generated_at',{ascending:false}).limit(20),
    s.rpc('upt_recovery_readiness'),
    s.from('automation_rules').select('automation_key,label,description,enabled,trigger_key,action_key,delay_minutes,reminder_minutes,escalation_minutes,audience,channels,auto_action,audit_enabled,cooldown_minutes,max_retries,last_run_at,settings').order('automation_key'),
  ])

  const loadProblems=[
    eventsResult.error&&'evenementen',
    recommendationsResult.error&&'planning',
    featuresResult.error&&'feature rollouts',
    knowledgeResult.error&&'kennisbank',
    qrResult.error&&'QR-resources',
    templatesResult.error&&'eventtemplates',
    versionsResult.error&&'configuratieversies',
    profilesResult.error&&'personeel',
    workplacesResult.error&&'werkplekken',
    inventoryResult.error&&'inventaris',
    reportsResult.error&&'rapportage',
    recoveryResult.error&&'recovery',
    automationResult.error&&'automatiseringen',
  ].filter((value):value is string=>Boolean(value))

  const events=eventsResult.data||[]
  const activeEvents=events.filter(e=>e.start_at<=now&&e.end_at>=now)
  const commandCenters:CommandCenter[]=[]
  for(const event of activeEvents.slice(0,4)){
    const {data}=await s.rpc('upt_command_center',{p_event:event.id})
    if(data&&typeof data==='object'&&!Array.isArray(data))commandCenters.push(data as unknown as CommandCenter)
  }

  const eventName=new Map(events.map(e=>[e.id,e.name]))
  const workplaceName=new Map((workplacesResult.data||[]).map(w=>[w.id,w.name]))
  const profileName=new Map((profilesResult.data||[]).map(p=>[p.id,p.full_name||'Personeelslid']))

  return <main className="mx-auto max-w-7xl space-y-7 p-4 pb-28 md:p-8">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-black uppercase tracking-[.2em] text-violet-400">PLATFORM OPERATIONS</p>
        <h1 className="text-3xl font-black">Platformbeheer</h1>
        <p className="mt-1 text-sm text-muted-foreground">Centraal beheer voor planning, eventtemplates, operationele signalen, materiaal, rapportage, kosten, QR, kennis, rollouts en herstelcontrole.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/admin" className="rounded-xl border px-4 py-3 font-bold">COMMAND CENTER</Link>
        <Link href="/inventory" className="rounded-xl border px-4 py-3 font-bold">INVENTARIS</Link>
      </div>
    </header>

    {loadProblems.length>0&&<div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
      <b>Enkele onderdelen konden niet laden.</b>
      <p className="mt-1 text-muted-foreground">Niet beschikbaar: {loadProblems.join(', ')}. De overige onderdelen blijven bruikbaar.</p>
    </div>}

    {!events.length&&<section className="rounded-2xl border border-violet-500/30 p-4">
      <h2 className="text-xl font-black">Begin hier</h2>
      <p className="mt-1 text-sm text-muted-foreground">Er zijn nog geen evenementen. Stel eerst je permanente werkplekken en standaardinventaris in; maak daarna een evenement. De masterlijst wordt automatisch overgenomen.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href="/inventory" className="rounded-xl bg-violet-600 px-4 py-3 font-bold text-white">STANDAARDINVENTARIS INSTELLEN</Link>
        <Link href="/events" className="rounded-xl border px-4 py-3 font-bold">EVENEMENT AANMAKEN</Link>
      </div>
    </section>}

    <PlatformAiAssistant/>

    <AutomationManager rules={(automationResult.data||[]).map(rule=>({
      ...rule,
      channels:rule.channels||[],
    }))}/>

    <section className="space-y-3">
      <h2 className="text-xl font-black">Live event-command-center</h2>
      {!commandCenters.length&&<p className="rounded-xl border p-4 text-muted-foreground">Geen lopend evenement.</p>}
      <div className="grid gap-3 lg:grid-cols-2">{commandCenters.map(center=><article key={center.event?.id} className="rounded-2xl border p-4">
        <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="font-black">{center.event?.name}</h3><p className="text-xs text-muted-foreground">{center.event?.status}</p></div><Link href="/admin" className="text-sm underline">Open live beheer</Link></div>
        <div className="grid gap-2 sm:grid-cols-2">{(center.workplaces||[]).map(w=>{
          const under=w.activeStaff<w.minimumStaff
          return <div key={w.id} className={'rounded-xl border p-3 '+(under?'border-red-500/50':'')}>
            <div className="flex items-center justify-between gap-2"><b>{w.name}</b><span className="text-xs font-black">{w.activeStaff}/{w.targetStaff}</span></div>
            <p className="mt-1 text-xs text-muted-foreground">{w.responsibles.length+' verantwoordelijke(n)'} · {w.openIncidents} incident(en) · {w.lowInventory} lage voorraad</p>
          </div>
        })}</div>
      </article>)}</div>
    </section>

    <section className="grid gap-5 xl:grid-cols-2">
      <article className="space-y-3 rounded-2xl border p-4">
        <div><h2 className="text-xl font-black">{platformModuleHelp('planning').label}</h2><p className="text-sm text-muted-foreground">{platformModuleHelp('planning').description}</p></div>
        <form action={generatePlanningRecommendations} className="flex flex-col gap-2 sm:flex-row">
          <select name="event_id" required className={input+' flex-1'}><option value="">Evenement kiezen…</option>{events.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select>
          <button className="rounded-xl bg-violet-600 px-4 py-3 font-bold text-white">GENEREER VOORSTELLEN</button>
        </form>
        {!recommendationsResult.data?.length&&<p className="text-sm text-muted-foreground">Geen open planningvoorstellen.</p>}
        {(recommendationsResult.data||[]).slice(0,12).map(r=><div key={r.id} className="rounded-xl border p-3">
          <p className="font-semibold">{profileName.get(r.recommended_user_id)} → {workplaceName.get(r.workplace_id)||'Werkplek'}</p>
          <p className="text-xs text-muted-foreground">{eventName.get(r.event_id)} · score {r.score} · {new Date(r.scheduled_start).toLocaleString('nl-BE')}</p>
          <div className="mt-2 flex gap-2"><form action={applyPlanningRecommendation}><input type="hidden" name="recommendation_id" value={r.id}/><button className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">TOEPASSEN</button></form><form action={dismissPlanningRecommendation}><input type="hidden" name="recommendation_id" value={r.id}/><button className="rounded-lg border px-3 py-2 text-xs font-bold">AFWIJZEN</button></form></div>
        </div>)}
      </article>

      <article className="space-y-3 rounded-2xl border p-4">
        <div><h2 className="text-xl font-black">{platformModuleHelp('templates').label}</h2><p className="text-sm text-muted-foreground">{platformModuleHelp('templates').description}</p></div>
        <form action={captureEventTemplate} className="grid gap-2">
          <select name="event_id" required className={input}><option value="">Bron-evenement…</option>{events.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select>
          <input name="name" required maxLength={200} placeholder="Templatenaam" className={input}/>
          <div className="grid grid-cols-2 gap-2 text-sm">{([['workplaces','Werkplekken'],['briefing','Briefing'],['tasks','Taken'],['checklists','Checklists'],['inventory','Inventaris']] as const).map(([value,label])=><label key={value} className="flex items-center gap-2"><input type="checkbox" name="section" value={value} defaultChecked/> {label}</label>)}</div>
          <button className="rounded-xl bg-violet-600 p-3 font-bold text-white">TEMPLATE OPSLAAN</button>
        </form>
        {(templatesResult.data||[]).map(t=><details key={t.id} className="rounded-xl border p-3"><summary className="cursor-pointer font-semibold">{t.name}</summary><form action={applyEventTemplate} className="mt-3 grid gap-2"><input type="hidden" name="template_id" value={t.id}/><input name="name" required placeholder="Nieuw evenement" className={input}/><DateInput name="start_at"/><DateInput name="end_at"/><input name="venue" placeholder="Locatie (optioneel)" className={input}/><input name="address" placeholder="Adres (optioneel)" className={input}/><button className="rounded-xl border p-3 font-bold">MAAK EVENEMENT UIT TEMPLATE</button></form></details>)}
      </article>
    </section>

    <section className="grid gap-5 xl:grid-cols-2">
      <article className="space-y-3 rounded-2xl border p-4">
        <div><h2 className="text-xl font-black">{platformModuleHelp('reporting').label}</h2><p className="text-sm text-muted-foreground">{platformModuleHelp('reporting').description}</p></div>
        <form action={generateEventReport} className="flex flex-col gap-2 sm:flex-row"><select name="event_id" required className={input+' flex-1'}><option value="">Evenement…</option>{events.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select><button className="rounded-xl border px-4 py-3 font-bold">GENEREER RAPPORT</button></form>
        <form action={savePayRate} className="grid gap-2 sm:grid-cols-2">
          <select name="user_id" required className={input}><option value="">Personeelslid…</option>{(profilesResult.data||[]).map(p=><option key={p.id} value={p.id}>{p.full_name||'Personeelslid'}</option>)}</select>
          <input name="hourly_rate" type="number" min="0" step="0.01" required placeholder="Uurloon €" className={input}/>
          <input name="employer_multiplier" type="number" min="1" max="5" step="0.01" defaultValue="1" className={input}/>
          <input name="effective_from" type="date" required defaultValue={new Date().toISOString().slice(0,10)} className={input}/>
          <input name="notes" maxLength={1000} placeholder="Notitie (optioneel)" className={input+' sm:col-span-2'}/>
          <button className="rounded-xl bg-violet-600 p-3 font-bold text-white sm:col-span-2">KOSTENTARIEF OPSLAAN</button>
        </form>
        <p className="text-xs text-muted-foreground">Kosten blijven indicatieve operationele schattingen tot officiële loon- en toeslagregels zijn geconfigureerd.</p>
        {(reportsResult.data||[]).slice(0,5).map(r=><div key={r.id} className="rounded-xl border p-3 text-sm"><b>{eventName.get(r.event_id)||'Evenement'}</b><p className="text-xs text-muted-foreground">{new Date(r.generated_at).toLocaleString('nl-BE')} · {r.generation_kind}</p></div>)}
      </article>

      <article className="space-y-3 rounded-2xl border p-4">
        <div><h2 className="text-xl font-black">{platformModuleHelp('assets').label}</h2><p className="text-sm text-muted-foreground">{platformModuleHelp('assets').description}</p></div>
        {(inventoryResult.data||[]).slice(0,20).map(item=><details key={item.id} className="rounded-xl border p-3"><summary className="cursor-pointer font-semibold">{item.name} · {item.available_quantity}/{item.total_quantity}</summary><form action={updateAssetMetadata} className="mt-3 grid gap-2 sm:grid-cols-2"><input type="hidden" name="item_id" value={item.id}/><input name="asset_code" defaultValue={item.asset_code||''} placeholder="Assetcode" className={input}/><input name="barcode" defaultValue={item.barcode||''} placeholder="Barcode / QR" className={input}/><input name="serial_number" defaultValue={item.serial_number||''} placeholder="Serienummer" className={input}/><input name="location_label" defaultValue={item.location_label||''} placeholder="Locatie" className={input}/><input name="maintenance_due_at" type="datetime-local" defaultValue={item.maintenance_due_at?new Date(item.maintenance_due_at).toISOString().slice(0,16):''} className={input}/><input name="reorder_threshold" type="number" min="0" defaultValue={item.reorder_threshold} className={input}/><input name="unit_cost" type="number" min="0" step="0.01" defaultValue={item.unit_cost_cents==null?'':item.unit_cost_cents/100} placeholder="Eenheidskost €" className={input}/><input name="asset_notes" defaultValue={item.asset_notes||''} placeholder="Assetnotitie" className={input}/><button className="rounded-xl border p-3 font-bold sm:col-span-2">ASSET OPSLAAN</button></form></details>)}
      </article>
    </section>

    <section className="grid gap-5 xl:grid-cols-2">
      <article className="space-y-3 rounded-2xl border p-4">
        <div><h2 className="text-xl font-black">{platformModuleHelp('knowledge').label}</h2><p className="text-sm text-muted-foreground">{platformModuleHelp('knowledge').description}</p></div>
        <form action={createKnowledgeArticle} className="grid gap-2">
          <input name="title" required maxLength={200} placeholder="Titel" className={input}/>
          <input name="category" maxLength={120} placeholder="Categorie" className={input}/>
          <select name="event_id" className={input}><option value="">Algemeen artikel</option>{events.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select>
          <select name="workplace_id" className={input}><option value="">Alle werkplekken</option>{(workplacesResult.data||[]).map(w=><option key={w.id} value={w.id}>{eventName.get(w.event_id)} — {w.name}</option>)}</select>
          <textarea name="body" required maxLength={20000} className={input+' min-h-28'} placeholder="Procedure of werkinstructie"/>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="offline_critical"/> Offline beschikbaar maken</label>
          <button className="rounded-xl bg-violet-600 p-3 font-bold text-white">ARTIKEL PUBLICEREN</button>
        </form>
        {(knowledgeResult.data||[]).slice(0,8).map(a=><div key={a.id} className="rounded-xl border p-3"><b>{a.title}</b><p className="text-xs text-muted-foreground">{a.category||'Algemeen'}{a.offline_critical?' · offline':''}</p></div>)}
      </article>

      <article className="space-y-3 rounded-2xl border p-4">
        <div><h2 className="text-xl font-black">{platformModuleHelp('qr').label}</h2><p className="text-sm text-muted-foreground">{platformModuleHelp('qr').description}</p></div>
        <form action={createQrResource} className="grid gap-2">
          <input name="title" required maxLength={200} placeholder="QR-titel" className={input}/>
          <select name="resource_type" className={input} defaultValue="workplace">{['workplace','inventory','document','checklist','task','knowledge'].map(x=><option key={x} value={x}>{x}</option>)}</select>
          <select name="event_id" className={input}><option value="">Geen specifiek evenement</option>{events.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select>
          <select name="workplace_id" className={input}><option value="">Geen specifieke werkplek</option>{(workplacesResult.data||[]).map(w=><option key={w.id} value={w.id}>{eventName.get(w.event_id)} — {w.name}</option>)}</select>
          <input name="route" required placeholder="/inventory" className={input}/>
          <button className="rounded-xl border p-3 font-bold">QR-RESOURCE AANMAKEN</button>
        </form>
        {(qrResult.data||[]).slice(0,8).map(q=><div key={q.id} className="rounded-xl border p-3"><b>{q.title}</b><p className="break-all text-xs text-muted-foreground">{'/q/'+q.code+' → '+q.route}</p></div>)}
      </article>
    </section>

    <section className="grid gap-5 xl:grid-cols-2">
      <article className="space-y-3 rounded-2xl border p-4">
        <div><h2 className="text-xl font-black">{platformModuleHelp('rollouts').label}</h2><p className="text-sm text-muted-foreground">{platformModuleHelp('rollouts').description}</p></div>
        {(featuresResult.data||[]).map(feature=><form key={feature.feature_key} action={setFeatureRollout} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <input type="hidden" name="feature_key" value={feature.feature_key}/><div><b>{feature.feature_key}</b><p className="text-xs text-muted-foreground">{feature.notes||'Geen notitie'}</p></div>
          <select name="audience" defaultValue={feature.audience} className={input}><option value="all">all</option><option value="admin">admin</option><option value="responsible">responsible</option><option value="staff">staff</option></select>
          <input name="rollout_percentage" type="number" min="0" max="100" defaultValue={feature.rollout_percentage} className={input+' w-24'}/>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" defaultChecked={feature.enabled}/> Actief</label>
          <input name="notes" defaultValue={feature.notes||''} placeholder="Notitie" className={input}/>
          <button className="rounded-xl border px-3 py-2 font-bold">OPSLAAN</button>
        </form>)}
      </article>

      <article className="space-y-3 rounded-2xl border p-4">
        <div><h2 className="text-xl font-black">{platformModuleHelp('recovery').label}</h2><p className="text-sm text-muted-foreground">{platformModuleHelp('recovery').description}</p></div>
        <form action={snapshotPlatformConfiguration} className="flex flex-col gap-2 sm:flex-row"><input name="note" maxLength={1000} placeholder="Versienotitie" className={input+' flex-1'}/><button className="rounded-xl border px-4 py-3 font-bold">SNAPSHOT MAKEN</button></form>
        <div className="rounded-xl border p-3 text-sm"><b>Recovery readiness</b><pre className="mt-2 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">{JSON.stringify(recoveryResult.data,null,2)}</pre></div>
        <div className="rounded-xl border border-amber-500/40 p-3 text-sm"><b>Staging</b><p className="mt-1 text-muted-foreground">De applicatie is staging-ready via feature rollouts en geïsoleerde CI. Een aparte Supabase databasebranch wordt pas geprovisioneerd na expliciete kostgoedkeuring.</p></div>
        {(versionsResult.data||[]).map(v=><div key={v.id} className="rounded-xl border p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><div><b>{v.kind}</b><p className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleString('nl-BE')} · {v.note||'zonder notitie'}</p></div><form action={restorePlatformConfiguration}><input type="hidden" name="version_id" value={v.id}/><button className="rounded-lg border border-amber-500/50 px-3 py-2 text-xs font-bold">CONFIGURATIE HERSTELLEN</button></form></div></div>)}
      </article>
    </section>
  </main>
}
