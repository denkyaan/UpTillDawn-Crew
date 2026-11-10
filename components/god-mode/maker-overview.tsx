'use client'

import {useEffect,useState,useSyncExternalStore} from 'react'
import {LANGUAGE_APPLIED_EVENT,initialUiLocale,parseUiLocale,type SupportedUiLocale} from '@/lib/locale-preferences'

type Destination='ai'|'builder'|'versions'|'connections'|'logs'
type Run={id:number;name:string;status:string;conclusion:string|null;url:string;current:boolean;sha:string;createdAt:string}
type Overview={
 branch:string;environment:string;githubConnected:boolean;githubAvailable:boolean;head:string|null;deployedSha:string|null;mainHead:string|null;
 ci:Run|null;deploy:Run|null;
 reports:{checked:number;open:number;needsMaker:number;failed:number}|null;
 checks:{code:boolean;ci:boolean;deploy:boolean;reports:boolean}
}
const dictionary={
 nl:{productieCode:'Laatst bevestigde productieversie',ciProduction:'CI production',deployProduction:'Deploy production',productionEnvironment:'Productie · live-omgeving · wijzigingen vereisen een afzonderlijke release',heading:'Technisch overzicht',intro:'De status van main-test, CI, deployments en foutherstel op één plaats. Personeelsbeheer blijft in Admin.',
  refresh:'Vernieuwen',loading:'Status controleren…',error:'De status kon niet worden opgehaald.',unknown:'Niet gecontroleerd',
  passed:'Geslaagd',failed:'Mislukt',running:'Bezig',queued:'Wacht',cancelled:'Geannuleerd',outdated:'Andere commit',
  source:'Broncode main',ci:'CI main',deploy:'Deploy main',reports:'Foutrapporten',needsMaker:'Makeractie nodig',
  errors:'Open fouten',inspected:'Meldingen gecontroleerd',none:'Geen Makeracties in de gecontroleerde lijst',
  openLogs:'Bekijk CI-logs',noRun:'Nog geen geverifieerde run voor deze versie',
  connection:'GitHub-koppeling',connected:'Gekoppeld',unconnected:'Geen schrijftoegang gekoppeld',
  next:'Prioriteit',allGood:'CI en deployment zijn groen voor dezelfde main-versie. Geen Makeracties in de gecontroleerde foutmeldingen.',
  ciFailure:'Onderzoek de laatste CI-fout voordat je wijzigingen publiceert.',
  deployPending:'CI is geslaagd, maar deployment van deze versie is nog niet bevestigd.',
  required:'Er staan foutrapporten open waarvoor Makeractie nodig is.',
  partial:'Een deel van de gegevens is niet beschikbaar. Ga niet uit van een groene status.',
  fix:'AI & herstel',fixHint:'Laat de AI foutmeldingen analyseren en een conceptoplossing voorbereiden',
  layout:'Visuele app-editor',layoutHint:'Bekijk of wijzig de layout zonder productie aan te raken',
  versions:'Versies & CI',versionsHint:'Bekijk voorstellen, testresultaten en terugzetopties',
  logs:'Systeemlogs',logsHint:'Bekijk bestaande app-, herstel- en auditregistraties',
  configure:'Koppelingen',configureHint:'Beheer bestaande GitHub- en databaseverbindingen',
  environment:'Main-test · productie staat los van deze omgeving'},
 fr:{productionCode:'Dernière version de production confirmée',ciProduction:'CI production',deployProduction:'Deploy production',productionEnvironment:'Production · environnement réel · version validée séparément',heading:'Tableau technique',intro:'État de main-test, CI, déploiements et réparation des erreurs au même endroit. Le personnel reste dans Admin.',
  refresh:'Actualiser',loading:'Vérification des états…',error:'Impossible de récupérer les états.',unknown:'Non vérifié',
  passed:'Réussi',failed:'Échec',running:'En cours',queued:'En attente',cancelled:'Annulé',outdated:'Autre commit',
  source:'Code main',ci:'CI main',deploy:'Deploy main',reports:'Rapports d’erreurs',needsMaker:'Action Créateur requise',
  errors:'Erreurs ouvertes',inspected:'Rapports vérifiés',none:'Aucune action requise dans les résultats vérifiés',
  openLogs:'Voir les journaux CI',noRun:'Aucune exécution vérifiée pour cette version',
  connection:'Connexion GitHub',connected:'Connecté',unconnected:'Pas d’accès en écriture',
  next:'Priorité',allGood:'CI et déploiement réussis sur la même version main. Aucune intervention signalée.',
  ciFailure:'Vérifier la dernière erreur CI avant publication.',
  deployPending:'CI réussie, mais déploiement de cette version non confirmé.',
  required:'Des rapports nécessitent une action du Créateur.',
  partial:'Certaines données sont indisponibles. Ne supposez pas que tout est validé.',
  fix:'IA & réparation',fixHint:'Analyser les erreurs et préparer une correction',
  layout:'Éditeur visuel',layoutHint:'Prévisualiser et ajuster sans toucher à la production',
  versions:'Versions & CI',versionsHint:'Propositions, tests et restauration',
  logs:'Journaux système',logsHint:'Consulter les journaux de l’application, récupération et audit',
  configure:'Connexions',configureHint:'Gérer les connexions GitHub et base de données',
  environment:'Main-test · production distincte'},
 en:{productionCode:'Last confirmed production version',ciProduction:'CI production',deployProduction:'Deploy production',productionEnvironment:'Production · live environment · separate release approval required',heading:'Technical overview',intro:'Main-test status, CI, deployments and error recovery in one place. Personnel is managed in Admin.',
  refresh:'Refresh',loading:'Checking status…',error:'Unable to load status.',unknown:'Unverified',
  passed:'Passed',failed:'Failed',running:'Running',queued:'Queued',cancelled:'Cancelled',outdated:'Different commit',
  source:'Main source',ci:'CI main',deploy:'Deploy main',reports:'Error reports',needsMaker:'Maker action needed',
  errors:'Open errors',inspected:'Reports checked',none:'No Maker actions in the checked reports',
  openLogs:'View CI logs',noRun:'No verified run for this version',
  connection:'GitHub connection',connected:'Connected',unconnected:'Write access not linked',
  next:'Priority',allGood:'CI and deploy passed for the same main version. No Maker actions in the checked errors.',
  ciFailure:'Investigate the latest CI failure before publishing changes.',
  deployPending:'CI passed, but this version has no confirmed deployment.',
  required:'Some error reports need Maker attention.',
  partial:'Some status data is unavailable. Do not assume everything passed.',
  fix:'AI & recovery',fixHint:'Diagnose errors and prepare a reviewable fix',
  layout:'Visual editor',layoutHint:'Preview and change layouts without touching production',
  versions:'Versions & CI',versionsHint:'Review proposals, tests and recovery options',
  logs:'System logs',logsHint:'Inspect available app, recovery and audit records',
  configure:'Connections',configureHint:'Manage the existing GitHub and database connections',
  environment:'Main-test · production is separate'},
 de:{productionCode:'Letzte bestätigte Produktionsversion',ciProduction:'CI production',deployProduction:'Deploy production',productionEnvironment:'Produktion · Live-Umgebung · separate Freigabe erforderlich',heading:'Technische Übersicht',intro:'Main-Teststatus, CI, Deployments und Fehlerbehebung an einem Ort. Personalverwaltung bleibt in Admin.',
  refresh:'Aktualisieren',loading:'Status wird geprüft…',error:'Status konnte nicht geladen werden.',unknown:'Nicht geprüft',
  passed:'Erfolgreich',failed:'Fehler',running:'Läuft',queued:'Wartet',cancelled:'Abgebrochen',outdated:'Anderer Commit',
  source:'Main-Quellcode',ci:'CI main',deploy:'Deploy main',reports:'Fehlerberichte',needsMaker:'Maker-Aktion nötig',
  errors:'Offene Fehler',inspected:'Geprüfte Meldungen',none:'Keine Maker-Aufgaben in den geprüften Berichten',
  openLogs:'CI-Logs ansehen',noRun:'Kein verifizierter Lauf für diese Version',
  connection:'GitHub-Verbindung',connected:'Verbunden',unconnected:'Kein Schreibzugriff verbunden',
  next:'Priorität',allGood:'CI und Deployment sind für dieselbe Main-Version erfolgreich. Keine Maker-Aufgaben in den geprüften Fehlern.',
  ciFailure:'Prüfe zuerst den CI-Fehler vor einer Veröffentlichung.',
  deployPending:'CI erfolgreich, aber Deployment dieser Version noch nicht bestätigt.',
  required:'Einige Fehlerberichte erfordern deine Aktion.',
  partial:'Einige Statusdaten fehlen. Nicht von erfolgreicher Prüfung ausgehen.',
  fix:'KI & Wiederherstellung',fixHint:'Fehler analysieren und überprüfbaren Fix vorbereiten',
  layout:'Visueller Editor',layoutHint:'Layouts testen und ändern ohne Produktion zu berühren',
  versions:'Versionen & CI',versionsHint:'Vorschläge, Tests und Wiederherstellung prüfen',
  logs:'Systemprotokolle',logsHint:'Verfügbare App-, Reparatur- und Auditprotokolle prüfen',
  configure:'Verbindungen',configureHint:'Bestehende GitHub- und Datenbankverbindungen verwalten',
  environment:'Main-Test · Produktion bleibt getrennt'},
} as const

export function MakerOverview({navigate,environment}:{navigate:(tab:Destination)=>void;environment:'main'|'production'}){
 const locale=useSyncExternalStore(
  notify=>{window.addEventListener(LANGUAGE_APPLIED_EVENT,notify);return()=>window.removeEventListener(LANGUAGE_APPLIED_EVENT,notify)},
  ()=>parseUiLocale(document.documentElement.lang)||initialUiLocale(),
  ()=>'nl' as SupportedUiLocale,
 )
 const t=dictionary[locale]
 const [state,setState]=useState<Overview|null>(null)
 const [error,setError]=useState(false)
 const [loading,setLoading]=useState(true)
 const [serial,setSerial]=useState(0)
 useEffect(()=>{
  const controller=new AbortController()
  fetch('/api/god/overview?environment='+environment,{cache:'no-store',signal:controller.signal})
   .then(async response=>{if(!response.ok)throw Error('overview');return await response.json() as Overview})
   .then(data=>{if(!controller.signal.aborted){setState(data);setError(false)}})
   .catch(()=>{if(!controller.signal.aborted)setError(true)})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false)})
  return()=>controller.abort()
 },[serial,environment])
 const label=(run:Run|null)=>{
  if(!run)return t.unknown
  if(!run.current)return t.outdated
  if(run.status==='in_progress')return t.running
  if(run.status==='queued'||run.status==='pending')return t.queued
  if(run.conclusion==='success')return t.passed
  if(run.conclusion==='failure')return t.failed
  if(run.conclusion==='cancelled')return t.cancelled
  return t.unknown
 }
 let priority=t.partial
 if(state){
  if(state.ci?.current&&state.ci.conclusion==='failure')priority=t.ciFailure
  else if((state.reports?.needsMaker||0)>0)priority=t.required
  else if(state.ci?.current&&state.ci.conclusion==='success'&&(!state.deploy?.current||state.deploy.conclusion!=='success'))priority=t.deployPending
  else if(state.ci?.current&&state.ci.conclusion==='success'&&state.deploy?.current&&state.deploy.conclusion==='success'&&state.reports!==null)priority=t.allGood
 }
 const actions=[
  {tab:'ai' as const,heading:t.fix,hint:t.fixHint},
  {tab:'builder' as const,heading:t.layout,hint:t.layoutHint},
  {tab:'logs' as const,heading:t.logs,hint:t.logsHint},
  {tab:'versions' as const,heading:t.versions,hint:t.versionsHint},
  {tab:'connections' as const,heading:t.configure,hint:t.configureHint},
 ]
 return <section className="space-y-5">
  <p className="rounded-xl border p-3 text-sm font-bold">{environment==='production'?t.productionEnvironment:t.environment}</p>
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div><h2 className="text-2xl font-black">{t.heading}</h2><p className="mt-1 text-sm text-muted-foreground">{t.intro}</p><p className="mt-1 text-xs text-muted-foreground">{environment==='production'?t.productionEnvironment:t.environment}</p></div>
   <button type="button" disabled={loading} onClick={()=>{setLoading(true);setSerial(x=>x+1)}} className="rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-60">{t.refresh}</button>
  </div>
  {loading&&<p role="status" className="text-sm">{t.loading}</p>}
  {error&&<p role="alert" className="rounded-xl border border-red-500/50 p-3 text-sm">{t.error}</p>}
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
   {[
    {heading:environment==='production'?t.productionCode:t.source,result:(environment==='production'?state?.deployedSha:state?.head)?.slice(0,8)||t.unknown},
    {heading:environment==='production'?t.ciProduction:t.ci,result:label(state?.ci||null)},
    {heading:environment==='production'?t.deployProduction:t.deploy,result:label(state?.deploy||null)},
    {heading:t.needsMaker,result:state?.reports?String(state.reports.needsMaker):t.unknown},
   ].map(item=><div key={item.heading} className="rounded-2xl border p-4"><p className="text-sm text-muted-foreground">{item.heading}</p><p className="mt-2 break-words text-xl font-black">{item.result}</p></div>)}
  </div>
  <div className="rounded-2xl border border-amber-500/30 p-4"><h3 className="font-black">{t.next}</h3><p role="status" className="mt-2 text-sm">{priority}</p></div>
  {state&&<section className="grid gap-3 sm:grid-cols-2">
    <div className="rounded-xl border p-4"><h3 className="font-bold">{t.reports}</h3>
      <p className="mt-1 text-sm">{t.errors}: {state.reports?.open??t.unknown}</p>
      <p className="text-sm">{t.inspected}: {state.reports?.checked??t.unknown}</p>
      <p className="text-sm">{t.connection}: {state.githubConnected?t.connected:t.unconnected}</p>
    </div>
    <div className="rounded-xl border p-4"><h3 className="font-bold">{t.ci} / {t.deploy}</h3>
      {[state.ci,state.deploy].filter((run):run is Run=>Boolean(run)).map(run=><a key={run.id} href={run.url} target="_blank" rel="noreferrer" className="mt-2 block text-sm text-violet-400 underline">{run.name} · {label(run)} · {t.openLogs}</a>)}
      {!state.ci&&!state.deploy&&<p className="mt-1 text-sm text-muted-foreground">{t.noRun}</p>}
    </div>
   </section>}
  <div className="grid gap-3 sm:grid-cols-2">
   {actions.map(action=><button key={action.tab} type="button" onClick={()=>navigate(action.tab)} className="rounded-2xl border p-4 text-left hover:border-violet-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500">
    <strong className="block">{action.heading}</strong><span className="mt-1 block text-sm text-muted-foreground">{action.hint}</span>
   </button>)}
  </div>
 </section>
}
