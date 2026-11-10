'use client'

import {useEffect,useMemo,useState,useSyncExternalStore} from 'react'
import {LANGUAGE_APPLIED_EVENT,initialUiLocale,parseUiLocale,type SupportedUiLocale} from '@/lib/locale-preferences'

type ErrorLog={id:string;error_name:string|null;error_message:string;route:string;status:string;ai_severity:string|null;maker_action_required:boolean;reported_count:number;created_at:string;updated_at:string}
type RecoveryLog={id:string;check_type:string;status:string;checked_at:string}
type AuditLog={id:string;action:string;entity_type:string;created_at:string}
type Snapshot={errors:ErrorLog[];recovery:RecoveryLog[];audit:AuditLog[]}
type PlatformLog={timestamp:string;source:string;message:string}
type Source='errors'|'recovery'|'audit'|'platform'
const dictionary={
 nl:{productionIntro:'Geregistreerde productie-fouten, herstelcontroles en auditgebeurtenissen. Alleen-lezen; de beheerverbinding moet toegang tot productie hebben.',heading:'App- en systeemlogs',intro:'Echte geregistreerde fout-, herstel- en auditgebeurtenissen van main-test. Geen productiegegevens.',
  refresh:'Vernieuwen',loading:'Logregistraties ophalen…',error:'De loggegevens zijn niet beschikbaar. Controleer de status van de databasekoppeling.',
  errors:'Appfouten',recovery:'Zelfherstel en controles',audit:'Wijzigingsaudit',search:'Zoeken in logs…',
  empty:'Geen registraties gevonden voor dit filter.',detail:'Details',timestamp:'Tijdstip',status:'Status',route:'Pagina',count:'Aantal meldingen',
  diagnose:'Onderzoek met AI',note:'Supabase-platformlogs tonen maximaal het laatste uur via de beveiligde beheerverbinding. Cloudflare-runtime­logs zijn nog niet aangesloten; GitHub Actions-logs staan onder Versies & CI.',
  limited:'Laatste 100 per bron',all:'Alle bronnen',platform:'Supabase-platform',platformUnavailable:'Platformlogs niet beschikbaar:'},
 fr:{productionIntro:'Erreurs, contrôles de récupération et audit de production. Lecture seule ; une connexion autorisée est nécessaire.',heading:'Journaux applicatifs et système',intro:'Erreurs, récupération et audit enregistrés sur main-test. Aucune donnée de production.',
  refresh:'Actualiser',loading:'Chargement des journaux…',error:'Journaux indisponibles. Vérifiez la connexion de la base.',
  errors:'Erreurs de l’app',recovery:'Récupération et contrôles',audit:'Audit des modifications',search:'Rechercher dans les journaux…',
  empty:'Aucun résultat pour ce filtre.',detail:'Détails',timestamp:'Date',status:'État',route:'Page',count:'Nombre de signalements',
  diagnose:'Analyser avec IA',note:'Les journaux de plateforme Supabase couvrent la dernière heure via une connexion autorisée. Les journaux Cloudflare ne sont pas encore reliés ; consultez Versions et CI pour GitHub Actions.',
  limited:'100 derniers par source',all:'Toutes les sources',platform:'Plateforme Supabase',platformUnavailable:'Journaux de plateforme indisponibles :'},
 en:{productionIntro:'Recorded production errors, recovery checks and audit events. Read only; an authorized production database connection is required.',heading:'App and system logs',intro:'Recorded main-test errors, recovery checks and audit events. No production data.',
  refresh:'Refresh',loading:'Loading logs…',error:'Logs unavailable. Check the database connection.',
  errors:'App errors',recovery:'Recovery and checks',audit:'Change audit',search:'Search logs…',
  empty:'No entries match this filter.',detail:'Details',timestamp:'Timestamp',status:'Status',route:'Page',count:'Report count',
  diagnose:'Diagnose with AI',note:'Supabase platform logs cover up to the last hour through an authorized connection. Cloudflare runtime logs remain unconnected; see Versions & CI for GitHub Actions logs.',
  limited:'Latest 100 per source',all:'All sources',platform:'Supabase platform',platformUnavailable:'Platform logs unavailable:'},
 de:{productionIntro:'Gespeicherte Produktionsfehler, Wiederherstellungsprüfungen und Auditereignisse. Nur lesbar; ein berechtigter Datenbankzugang ist erforderlich.',heading:'App- und Systemprotokolle',intro:'Gespeicherte Fehler-, Reparatur- und Auditereignisse der Main-Testumgebung. Keine Produktionsdaten.',
  refresh:'Aktualisieren',loading:'Protokolle werden geladen…',error:'Protokolle sind nicht verfügbar. Prüfe die Datenbankverbindung.',
  errors:'App-Fehler',recovery:'Wiederherstellung und Prüfungen',audit:'Änderungsaudit',search:'Protokolle durchsuchen…',
  empty:'Keine passenden Einträge.',detail:'Details',timestamp:'Zeitpunkt',status:'Status',route:'Seite',count:'Anzahl Meldungen',
  diagnose:'Mit KI analysieren',note:'Supabase-Plattformprotokolle zeigen die letzte Stunde über eine autorisierte Verbindung. Cloudflare-Laufzeitprotokolle sind noch nicht verbunden; GitHub Actions unter Versionen & CI.',
  limited:'Letzte 100 je Quelle',all:'Alle Quellen',platform:'Supabase-Plattform',platformUnavailable:'Plattformprotokolle nicht verfügbar:'},
} as const

export function MakerLogs({onDiagnose,environment}:{onDiagnose:(id:string,prompt:string)=>void;environment:'main'|'production'}){
 const locale=useSyncExternalStore(
  notify=>{window.addEventListener(LANGUAGE_APPLIED_EVENT,notify);return()=>window.removeEventListener(LANGUAGE_APPLIED_EVENT,notify)},
  ()=>parseUiLocale(document.documentElement.lang)||initialUiLocale(),
  ()=>'nl' as SupportedUiLocale,
 )
 const t=dictionary[locale]
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null)
 const [platformLogs,setPlatformLogs]=useState<PlatformLog[]>([])
 const [platformError,setPlatformError]=useState('')
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState(false)
 const [generation,setGeneration]=useState(0)
 const [source,setSource]=useState<Source|'all'>('all')
 const [search,setSearch]=useState('')
 useEffect(()=>{
  const controller=new AbortController()
  fetch('/api/god/platform-logs?environment='+environment+'&limit=100',{signal:controller.signal,cache:'no-store'})
   .then(async response=>{
    const json=await response.json() as {logs?:PlatformLog[];error?:string}
    if(!response.ok)throw Error(json.error||'Platform logs unavailable')
    return Array.isArray(json.logs)?json.logs:[]
   })
   .then(logs=>{if(!controller.signal.aborted){setPlatformLogs(logs);setPlatformError('')}})
   .catch(error=>{if(!controller.signal.aborted){setPlatformLogs([]);setPlatformError(error instanceof Error?error.message:'Platform logs unavailable')}})
  return()=>controller.abort()
 },[generation,environment])
 useEffect(()=>{
  const controller=new AbortController()
  fetch('/api/god/logs?environment='+environment+'&limit=100',{signal:controller.signal,cache:'no-store'})
   .then(async response=>{
    if(!response.ok)throw Error('Logs unavailable')
    const json=await response.json() as {logs?:Partial<Snapshot>}
    if(!json.logs)throw Error('No logs')
    return {errors:json.logs.errors||[],recovery:json.logs.recovery||[],audit:json.logs.audit||[]}
   })
   .then(rows=>{if(!controller.signal.aborted){setSnapshot(rows);setError(false)}})
   .catch(()=>{if(!controller.signal.aborted)setError(true)})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false)})
  return()=>controller.abort()
 },[generation,environment])
 const rows=useMemo(()=>{
  if(!snapshot)return []
  const all=[
   ...snapshot.errors.map(r=>({key:r.id,kind:'errors' as const,date:r.created_at,heading:r.error_name||'Application error',message:r.error_message,detail:r.route,level:r.status,report:r})),
   ...snapshot.recovery.map(r=>({key:r.id,kind:'recovery' as const,date:r.checked_at,heading:r.check_type,message:r.status,detail:'',level:r.status,report:null})),
   ...snapshot.audit.map(r=>({key:r.id,kind:'audit' as const,date:r.created_at,heading:r.action,message:r.entity_type,detail:'',level:'',report:null})),
   ...platformLogs.map((r,i)=>({key:String(i)+'-'+r.timestamp,kind:'platform' as const,date:r.timestamp,heading:r.source,message:r.message,detail:'',level:'',report:null})),
  ]
  const needle=search.toLocaleLowerCase()
  return all.filter(item=>(source==='all'||item.kind===source)&&
   (!needle||[item.heading,item.message,item.detail,item.level,item.date].join(' ').toLocaleLowerCase().includes(needle)))
   .sort((a,b)=>Date.parse(b.date)-Date.parse(a.date))
 },[snapshot,search,source,platformLogs])
 return <section className="space-y-4">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div><h2 className="text-2xl font-black">{t.heading}</h2><p className="mt-1 text-sm text-muted-foreground">{environment==='production'?t.productionIntro:t.intro}</p></div>
   <button type="button" disabled={loading} onClick={()=>{setLoading(true);setGeneration(x=>x+1)}} className="rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-50">{t.refresh}</button>
  </div>
  <div className="grid gap-2 sm:grid-cols-5">
   {(['all','errors','recovery','audit','platform'] as const).map(kind=>
    <button type="button" key={kind} aria-pressed={source===kind} onClick={()=>setSource(kind)} className={'rounded-xl border p-3 text-sm font-bold '+(source===kind?'bg-violet-600 text-white':'hover:border-violet-400')}>
     {kind==='all'?t.all:t[kind]}{kind!=='all'&&snapshot?' · '+(kind==='platform'?platformLogs.length:snapshot[kind].length):''}
    </button>)}
  </div>
  <input aria-label={t.search} placeholder={t.search} value={search} onChange={e=>setSearch(e.target.value)} className="w-full rounded-xl border bg-background p-3"/>
  {loading&&<p role="status" className="text-sm">{t.loading}</p>}
  {error&&<p role="alert" className="rounded-xl border border-red-500/40 p-3 text-sm">{t.error}</p>}
  {platformError&&<p role="status" className="rounded-xl border border-amber-500/40 p-3 text-sm">{t.platformUnavailable} {platformError}</p>}
  {!loading&&!error&&!rows.length&&<p className="rounded-xl border border-dashed p-4 text-sm">{t.empty}</p>}
  <div className="space-y-2">
   {rows.map(item=><article key={item.kind+'-'+item.key} className="rounded-xl border p-3">
    <div className="flex flex-wrap items-start justify-between gap-3">
     <div className="min-w-0 flex-1">
      <p className="break-words font-bold">{item.heading} · {t[item.kind]}</p>
      <p className="mt-1 break-words text-sm">{item.message}</p>
      <p className="mt-1 break-all text-xs text-muted-foreground">{t.timestamp}: {new Date(item.date).toLocaleString(locale==='nl'?'nl-BE':locale)} · {t.status}: {item.level||'—'} {item.detail&&' · '+t.route+': '+item.detail}</p>
     </div>
     {item.report&&<button type="button" onClick={()=>onDiagnose(item.report.id,
      'Analyseer dit app-foutrapport: '+item.report.error_message+' op '+item.report.route+'. Zoek de hoofdoorzaak in main, behoud bestaande functies en maak een gecontroleerd herstelvoorstel met regressietests.')} className="rounded-lg border border-violet-500/50 px-3 py-2 text-sm font-bold">{t.diagnose}</button>}
    </div>
   </article>)}
  </div>
  <p className="text-xs text-muted-foreground">{t.limited}. {t.note}</p>
 </section>
}
