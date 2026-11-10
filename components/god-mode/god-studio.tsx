'use client'

import dynamic from 'next/dynamic'
import {useEffect,useRef,useState} from 'react'
import {GodModeEditor} from './god-mode-editor'
import {GodVisualBuilder} from './god-visual-builder'
import {GodAutomationBuilder} from './god-automation-builder'
import {GodDataEditor} from './god-data-editor'
import {GodSqlEditor} from './god-sql-editor'
import {editablePath,summarizeChanges,type SourceChange,type SourceEntry,type SourceTarget} from '@/lib/god-studio'
import {humanizeAppError} from '@/lib/client-error-message'
import targets from '@/lib/god-source-index.json'

const CodeEditor=dynamic(()=>import('./code-editor'),{ssr:false,loading:()=> <p>Code-editor laden…</p>})
const sections=[['overview','Overzicht'],['monitor','Fouten & logs'],['ai','AI-assistent'],['builder','Layout'],['tools','Technisch']] as const
const tabs=[['automations','Automaties'],['source','Programmering'],['elements','Onderdelen'],['data','Gegevens'],['sql','SQL'],['roles','Rolnavigatie'],['versions','Versies & release'],['connections','Koppelingen']] as const
type Tab=typeof tabs[number][0]|'overview'|'monitor'|'ai'|'builder'
const toolKeys=new Set<string>(tabs.map(([key])=>key))
type Proposal={number:number;url:string;sha:string;branch:string}
type Commit={sha:string;html_url:string;commit:{message:string;author:{date:string}}}
type Pull={number:number;html_url:string;title:string;head:{sha:string;ref:string}}
type Run={id:number;name:string;status:string;conclusion:string|null;html_url:string;head_sha:string}
type RecoveryReport={
  id:string
  route:string
  error_name:string|null
  error_message:string
  stack_trace:string|null
  status:string
  ai_category:string|null
  ai_severity:string|null
  ai_summary:string|null
  ai_user_message:string|null
  maker_action_required:boolean
  maker_action:string|null
  god_prompt:string|null
  reported_count:number
  processing_attempts:number
  created_at:string
  updated_at:string
}
type TextAiResult={
  base:string
  title:string
  answer:string
  changes:SourceChange[]
  selectedFiles:string[]
  sourceSelection:string
}

function reportStatusLabel(status:string){
  if(status==='needs_maker')return 'MAKERACTIE'
  if(status==='maker_working')return 'IN BEHANDELING'
  if(status==='processing')return 'AI ANALYSEERT'
  if(status==='reported')return 'GERAPPORTEERD'
  if(status==='resolved'||status==='auto_resolved')return 'OPGELOST'
  if(status==='failed')return 'MISLUKT'
  return status
}

async function api<T>(url:string,body?:unknown,method=body?'POST':'GET'):Promise<T>{
  const response=await fetch(url,{method,cache:'no-store',...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})})
  const data=await response.json()
  if(!response.ok)throw new Error(humanizeAppError(data.error||'De actie is mislukt.'))
  return data as T
}

export function GodStudio({securityAudit}:{securityAudit?:React.ReactNode}){
  const [tab,setTab]=useState<Tab>('overview')
  const [environment,setEnvironment]=useState<'main'|'production'>('main')
  const [files,setFiles]=useState<SourceEntry[]>([])
  const [base,setBase]=useState('')
  const [connected,setConnected]=useState(false)
  const [databaseConnected,setDatabaseConnected]=useState(false)
  const [path,setPath]=useState('')
  const [line,setLine]=useState(1)
  const [originals,setOriginals]=useState<Record<string,string>>({})
  const [drafts,setDrafts]=useState<Record<string,string|null>>({})
  const [search,setSearch]=useState('')
  const [newPath,setNewPath]=useState('')
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [title,setTitle]=useState('')
  const [aiPrompt,setAiPrompt]=useState('')
  const [aiReply,setAiReply]=useState<{answer:string;changes:SourceChange[]}|null>(null)
  const [textAiPrompt,setTextAiPrompt]=useState('')
  const [textAiResult,setTextAiResult]=useState<TextAiResult|null>(null)
  const [errorReports,setErrorReports]=useState<RecoveryReport[]>([])
  const [selectedErrorReport,setSelectedErrorReport]=useState<string|null>(null)
  const [proposal,setProposal]=useState<Proposal|null>(null)
  const [history,setHistory]=useState<Commit[]>([])
  const [pulls,setPulls]=useState<Pull[]>([])
  const [runs,setRuns]=useState<Run[]>([])
  const [operationsRuns,setOperationsRuns]=useState<Run[]>([])
  const [operationsError,setOperationsError]=useState('')
  const [lastRefreshed,setLastRefreshed]=useState('')
  const [logSearch,setLogSearch]=useState('')
  const [onlyOpen,setOnlyOpen]=useState(true)
  const [credential,setCredential]=useState('')
  const [databaseKey,setDatabaseKey]=useState('')
  const [elementSearch,setElementSearch]=useState('')
  const [previewPath,setPreviewPath]=useState('/')
  const [preview,setPreview]=useState('')
  const [previewWidth,setPreviewWidth]=useState('100%')
  const [restore,setRestore]=useState('')
  const requestId=useRef(0)
  const uploadRef=useRef<HTMLInputElement>(null)
  const changes=Object.entries(drafts).filter(([file,content])=>content===null||!files.some(f=>f.path===file)||content!==originals[file]).map(([file,content])=>({path:file,content}))
  const value=drafts[path]===null?'':drafts[path]??originals[path]??''

  async function action(task:()=>Promise<void>){
    if(busy)return
    setBusy(true);setMessage('')
    try{await task()}catch(error){setMessage(humanizeAppError(error))}
    finally{setBusy(false)}
  }
  async function load(){
    const data=await api<{head:string;connected:boolean;files:SourceEntry[]}>('/api/god/source')
    setBase(data.head);setConnected(data.connected);setFiles(data.files)
  }
  useEffect(()=>{let active=true;void api<{head:string;connected:boolean;files:SourceEntry[]}>('/api/god/source').then(data=>{if(active){setBase(data.head);setConnected(data.connected);setFiles(data.files)}}).catch(error=>{if(active)setMessage(humanizeAppError(error))});void api<{connected:boolean}>('/api/god/sql').then(data=>{if(active)setDatabaseConnected(data.connected)}).catch(()=>{});return()=>{active=false}},[])
  useEffect(()=>{
    let active=true
    void api<{reports:RecoveryReport[]}>(`/api/god/error-reports?limit=60&environment=${environment}`)
      .then(data=>{
        if(!active)return
        setErrorReports(data.reports)
        const requested=new URLSearchParams(window.location.search).get('error-report')
        if(!requested)return
        const report=data.reports.find(item=>item.id===requested)
        if(!report)return
        setSelectedErrorReport(report.id)
        setTextAiPrompt(current=>current||recoveryPrompt(report))
        setTab('ai')
      })
      .catch(()=>{})
    return()=>{active=false}
  },[environment])
  useEffect(()=>{if(!changes.length)return;const guard=(event:BeforeUnloadEvent)=>{event.preventDefault()};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard)},[changes.length])

  async function open(file:string,targetLine=1){
    const id=++requestId.current
    setPath(file);setLine(targetLine);setTab('source');setMessage('')
    if(originals[file]!==undefined||drafts[file]!==undefined)return
    try{
      const data=await api<{content:string}>(`/api/god/source?action=file&path=${encodeURIComponent(file)}&ref=${base}`)
      setOriginals(current=>({...current,[file]:data.content}))
      if(requestId.current===id)setLine(targetLine)
    }catch(error){if(requestId.current===id)setMessage(error instanceof Error?humanizeAppError(error):'Bestand openen mislukt.')}
  }
  function addFile(){
    const file=newPath.trim()
    if(!editablePath(file)){setMessage('Gebruik een geldig bronpad, bijvoorbeeld components/mijn-knop.tsx.');return}
    if(files.some(f=>f.path===file)||Object.hasOwn(drafts,file)){setMessage('Dit bestand bestaat al.');return}
    setOriginals(current=>({...current,[file]:''}));setDrafts(current=>({...current,[file]:''}));setPath(file);setTab('source');setLine(1);setNewPath('')
  }
  function exportDraft(){
    const blob=new Blob([JSON.stringify({base,title:title||'God Mode concept',changes},null,2)],{type:'application/json'})
    const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='god-mode-concept.json';link.click();URL.revokeObjectURL(url)
  }
  async function importDraft(file:File){
    const {changeSetSchema}=await import('@/lib/god-studio')
    const data=changeSetSchema.parse(JSON.parse(await file.text()))
    if(data.base!==base)throw new Error('Dit concept hoort bij een andere bronversie. Vergelijk de code voordat je wijzigingen overneemt.')
    const missing=data.changes.filter(c=>originals[c.path]===undefined&&files.some(f=>f.path===c.path))
    const loaded=await Promise.all(missing.map(async c=>[c.path,(await api<{content:string}>(`/api/god/source?action=file&path=${encodeURIComponent(c.path)}&ref=${base}`)).content] as const))
    setOriginals(current=>({...current,...Object.fromEntries(loaded)}));setDrafts(current=>({...current,...Object.fromEntries(data.changes.map(c=>[c.path,c.content]))}));setTitle(data.title)
  }
  async function save(){
    const result=await api<{proposal:Proposal}>('/api/god/source',{action:'save',base,title,changes})
    setProposal(result.proposal);setDrafts({});setTab('versions');setMessage('Codevoorstel opgeslagen. GitHub voert de tests uit. De live app is nog niet gewijzigd.')
    await loadHistory()
  }
  async function loadHistory(){
    const data=await api<{commits:Commit[];pulls:Pull[]}>('/api/god/source?action=history');setHistory(data.commits);setPulls(data.pulls)
  }
  async function askAi(){
    const selected=Array.from(new Set([path,...changes.map(c=>c.path)])).filter(Boolean)
    const context=selected.map(file=>({path:file,content:drafts[file]??originals[file]??''})).filter(f=>drafts[f.path]!==null)
    setAiReply(await api('/api/god/code-assistant',{message:aiPrompt,files:context}))
  }
  async function applyAi(){
    if(!aiReply)return
    const existing=aiReply.changes.filter(c=>files.some(f=>f.path===c.path)&&originals[c.path]===undefined)
    if(existing.length)throw new Error('De AI wil een bestaand bestand wijzigen dat niet was geopend. Open dat bestand eerst en vraag een nieuw voorstel met die context.')
    setDrafts(current=>({...current,...Object.fromEntries(aiReply.changes.map(c=>[c.path,c.content]))}));setAiReply(null);setMessage('AI-voorstel in je concept gezet. Controleer de verschillen voordat je opslaat.')
  }

  function recoveryPrompt(report:RecoveryReport){
    return report.god_prompt||[
      'Onderzoek en herstel dit gemelde productiefoutrapport.',
      `Pagina: ${report.route}`,
      `Fout: ${report.error_message}`,
      report.ai_summary?`AI-diagnose: ${report.ai_summary}`:'',
      report.maker_action?`Vereiste makeractie: ${report.maker_action}`:'',
      'Maak de kleinste veilige wijziging, behoud bestaande autorisatie en voeg regressietests toe.',
    ].filter(Boolean).join('\n')
  }

  async function loadOperations(){
    try{
      const data=await api<{runs:Run[]}>(`/api/god/source?action=operations&environment=${environment}`)
      setOperationsRuns(data.runs)
      setOperationsError('')
    }catch(error){
      setOperationsError(humanizeAppError(error))
    }
    setLastRefreshed(new Date().toISOString())
  }
  useEffect(()=>{
    let active=true
    const refresh=()=>void api<{runs:Run[]}>('/api/god/source?action=operations').then(data=>{
      if(active){setOperationsRuns(data.runs);setOperationsError('');setLastRefreshed(new Date().toISOString())}
    }).catch(error=>{if(active)setOperationsError(humanizeAppError(error))})
    refresh()
    const interval=window.setInterval(refresh,60000)
    return()=>{active=false;window.clearInterval(interval)}
  },[environment])
  useEffect(()=>{setOperationsRuns([]);setErrorReports([]);setOperationsError('')},[environment])
  const pendingReports=errorReports.filter(report=>!['resolved','auto_resolved'].includes(report.status))
  const urgentReports=pendingReports.filter(report=>report.maker_action_required||['critical','high'].includes(report.ai_severity||''))
  const filteredReports=errorReports.filter(report=>
    (!onlyOpen||!['resolved','auto_resolved'].includes(report.status))&&
    [report.route,report.error_name,report.error_message,report.ai_summary,report.status,report.ai_category]
      .some(value=>(value||'').toLowerCase().includes(logSearch.trim().toLowerCase()))
  )
  const failedDeploys=operationsRuns.filter(run=>run.conclusion==='failure'&&['CI main','Deploy main','CI production','Deploy production'].includes(run.name))
  const activeRoot=toolKeys.has(tab)?'tools':tab

  async function loadErrorReports(){
    const data=await api<{reports:RecoveryReport[]}>('/api/god/error-reports?limit=60')
    setErrorReports(data.reports)
    if(typeof window!=='undefined'){
      const requested=new URLSearchParams(window.location.search).get('error-report')
      if(requested){
        const report=data.reports.find(item=>item.id===requested)
        if(report){
          setSelectedErrorReport(report.id)
          setTextAiPrompt(current=>current||recoveryPrompt(report))
          setTab('ai')
        }
      }
    }
  }

  async function executeTextAi(){
    const prompt=textAiPrompt.trim()
    if(!prompt)throw new Error('Beschrijf eerst wat de AI moet uitvoeren.')
    if(changes.length)throw new Error('Er staan al conceptwijzigingen klaar. Sla ze eerst op, exporteer ze of maak ze ongedaan voordat je een nieuwe AI-uitvoering start.')

    const result=await api<TextAiResult>('/api/god/text-execution',{
      message:prompt,
      ...(selectedErrorReport?{errorReportId:selectedErrorReport}:{}),
    })

    const selected=new Set(result.selectedFiles)
    const existingChanges=result.changes.filter(change=>selected.has(change.path))
    const loaded=await Promise.all(existingChanges.map(async change=>{
      const data=await api<{content:string}>(`/api/god/source?action=file&path=${encodeURIComponent(change.path)}&ref=${result.base}`)
      return [change.path,data.content] as const
    }))

    setBase(result.base)
    setOriginals(current=>({...current,...Object.fromEntries(loaded)}))
    setDrafts(current=>({...current,...Object.fromEntries(result.changes.map(change=>[change.path,change.content]))}))
    setTitle(result.title)
    setTextAiResult(result)
    if(result.changes[0])setPath(result.changes[0].path)
    await load()
    if(selectedErrorReport)await loadErrorReports()
    setMessage('AI tekstuitvoering is als concept klaargezet. Controleer de wijzigingen en publiceer pas na geslaagde tests.')
  }

  async function resolveErrorReport(reportId:string){
    await api('/api/god/error-reports',{action:'resolve',reportId,note:'Maker heeft de gemelde fout na controle als opgelost gemarkeerd.'})
    if(selectedErrorReport===reportId)setSelectedErrorReport(null)
    await loadErrorReports()
    setMessage('Foutrapport als opgelost gemarkeerd. De gebruiker krijgt een melding.')
  }
  function inspectFrame(frame:HTMLIFrameElement){
    try{
      const doc=frame.contentDocument;if(!doc)return
      doc.addEventListener('click',event=>{
        event.preventDefault();event.stopPropagation();event.stopImmediatePropagation()
        const element=event.target && (event.target as Node).nodeType===1 ? event.target as HTMLElement : null
        const target=element?.closest('button,a,input,select,textarea,label,h1,h2,h3')||element
        const text=(target?.getAttribute('aria-label')||target?.textContent||'').trim().replace(/\s+/g,' ').slice(0,80)
        if(text){setElementSearch(text);setMessage(`Onderdeel geselecteerd: ${text}`)}
      },true)
      doc.addEventListener('submit',event=>event.preventDefault(),true)
    }catch{setMessage('Deze pagina kan niet worden geïnspecteerd. Gebruik de onderdelenzoeker hieronder.')}
  }
  const indexed=(targets as SourceTarget[]).filter(t=>`${t.label} ${t.handler} ${t.file}`.toLowerCase().includes(elementSearch.toLowerCase())).slice(0,100)

  function prepareAiFromBuilder(prompt:string,file?:string,line=1){
    setAiPrompt(prompt)
    if(file){
      void open(file,line)
      return
    }
    setTab('source')
    setMessage('AI-opdracht voorbereid. Open het relevante bronbestand zodat de AI voldoende context krijgt.')
  }

  return <div className="space-y-4">
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3">
      <div><p className="font-bold">Omgeving</p><p className="text-xs text-muted-foreground">{environment==='main'?'Main · ontwikkeling en tests':'Productie · live-appgegevens; code via gecontroleerde release'}</p></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={environment==='main'} onClick={()=>{setEnvironment('main');setTab('overview')}} className={`rounded-xl border px-4 py-2 text-sm font-bold ${environment==='main'?'border-violet-500 bg-violet-600 text-white':''}`}>Main (test)</button>
        <button type="button" aria-pressed={environment==='production'} onClick={()=>{setEnvironment('production');setTab('overview')}} className={`rounded-xl border px-4 py-2 text-sm font-bold ${environment==='production'?'border-amber-500 bg-amber-500/20 text-amber-400':''}`}>Productie (live)</button>
      </div>
    </section>
    {environment==='production'&&<p className="rounded-xl border border-amber-500/50 p-3 text-sm text-amber-400">Je bekijkt productie. SQL is hier alleen-lezen; broncode, database- en automatiseringswijzigingen verlopen via main en de expliciete productierelease. Geen automatische productiedeployments.</p>}
    <nav aria-label="Maker controlekamer" className="flex flex-wrap gap-2 rounded-2xl border p-2">{sections.map(([key,label])=><button type="button" key={key} aria-pressed={activeRoot===key} onClick={()=>setTab(key==='tools'?'source':key)} className={`rounded-xl px-4 py-3 text-sm font-bold ${activeRoot===key?'bg-violet-600 text-white':'hover:bg-muted'}`}>{label}</button>)}</nav>
    {activeRoot==='tools'&&<nav aria-label="Geavanceerde Maker-gereedschappen" className="flex flex-wrap gap-2 rounded-xl border p-2">{tabs.map(([key,label])=><button type="button" key={key} aria-pressed={tab===key} onClick={()=>{setTab(key);if(key==='versions')void action(loadHistory)}} className={`rounded-lg px-3 py-2 text-xs font-bold ${tab===key?'bg-violet-600 text-white':'hover:bg-muted'}`}>{label}</button>)}</nav>}
    {message&&<p role="status" className="whitespace-pre-wrap rounded-xl border border-violet-500/40 p-3 text-sm">{message}</p>}
    {environment==='production'&&['builder','automations','data','roles','source','elements'].includes(tab)&&<section className="rounded-xl border border-amber-500/40 p-5"><p className="font-semibold">Wijzigingen voorbereiden op main</p><p className="mt-2 text-sm text-muted-foreground">Deze editor verandert de testomgeving. Bereid de wijziging op main voor, laat de tests slagen en start daarna expliciet de CI production en Deploy production.</p><button type="button" onClick={()=>setEnvironment('main')} className="mt-3 rounded-lg border px-4 py-2">Naar main overschakelen</button></section>}
    {tab==='overview'&&<section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <button type="button" onClick={()=>setTab('monitor')} className="rounded-2xl border p-4 text-left">
          <p className="text-sm text-muted-foreground">Open foutrapporten</p><p className="mt-2 text-3xl font-black">{pendingReports.length}</p>
        </button>
        <button type="button" onClick={()=>setTab('monitor')} className="rounded-2xl border p-4 text-left">
          <p className="text-sm text-muted-foreground">Dringende makeracties</p><p className="mt-2 text-3xl font-black">{urgentReports.length}</p>
        </button>
        <button type="button" onClick={()=>setTab('versions')} className="rounded-2xl border p-4 text-left">
          <p className="text-sm text-muted-foreground">Mislukte recente CI/deploy-runs</p><p className="mt-2 text-3xl font-black">{failedDeploys.length}</p>
        </button>
        <button type="button" onClick={()=>setTab('ai')} className="rounded-2xl border p-4 text-left">
          <p className="text-sm text-muted-foreground">AI-herstel</p><p className="mt-2 text-lg font-black">Nieuwe opdracht</p>
        </button>
      </div>
      <section className="space-y-3 rounded-2xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-black">GitHub · CI en deployment</h2>
          <button type="button" disabled={busy} onClick={()=>void action(loadOperations)} className="rounded-xl border px-4 py-2 text-sm">Vernieuwen</button>
        </div>
        {lastRefreshed&&<p className="text-xs text-muted-foreground">Laatste controle: {new Date(lastRefreshed).toLocaleString('nl-BE')} · automatische hercontrole om de minuut</p>}
        {operationsError&&<p role="alert" className="text-sm text-amber-500">{operationsError}</p>}
        {!operationsRuns.length&&!operationsError&&<p className="text-sm text-muted-foreground">Workflowstatus wordt geladen.</p>}
        {operationsRuns.slice(0,10).map(run=><a key={run.id} href={run.html_url} rel="noopener noreferrer" target="_blank" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm">
          <span className="font-semibold">{run.name}</span><span>{run.conclusion||run.status}</span>
          <span className="font-mono text-xs text-muted-foreground">{run.head_sha.slice(0,8)}</span>
        </a>)}
      </section>
      {urgentReports.length>0&&<section className="rounded-2xl border border-amber-500/50 p-4">
        <h2 className="font-black">Fouten die aandacht vereisen</h2>
        {urgentReports.slice(0,5).map(report=><button type="button" key={report.id} onClick={()=>{setLogSearch(report.route);setTab('monitor')}} className="mt-2 block w-full rounded-xl border p-3 text-left text-sm">
          {report.route} · {report.ai_severity||report.status} · {report.error_message.slice(0,160)}
        </button>)}
      </section>}
      <p className="text-xs text-muted-foreground">Dit overzicht bevat geregistreerde appfouten en GitHub Actions. Rechtstreekse Cloudflare Worker-consolelogs zijn hier nog niet aangesloten.</p>
    </section>}
    {tab==='builder'&&environment==='main'&&<GodVisualBuilder onOpenSource={(file,line)=>void open(file,line)} onPrepareAi={prepareAiFromBuilder}/>}
    {tab==='ai'&&<section className="space-y-5">
      <div className="space-y-3 rounded-2xl border border-violet-500/40 bg-violet-500/5 p-4">
        <div>
          <h2 className="text-xl font-black">AI tekstuitvoering</h2>
          <p className="text-sm text-muted-foreground">Beschrijf in gewone taal wat er aan de app moet veranderen. De AI zoekt zelf de relevante bronbestanden, voert de wijziging uit in een concept en zet niets rechtstreeks live.</p>
        </div>
        {selectedErrorReport&&<div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/40 p-3 text-sm">
          <span>Foutrapport gekoppeld: {selectedErrorReport.slice(0,8)}</span>
          <button type="button" onClick={()=>setSelectedErrorReport(null)} className="rounded-lg border px-3 py-2">Loskoppelen</button>
        </div>}
        <textarea
          aria-label="AI tekstuitvoering opdracht"
          value={textAiPrompt}
          onChange={event=>setTextAiPrompt(event.target.value)}
          rows={7}
          maxLength={8000}
          placeholder="Bijvoorbeeld: voeg bij elke foutmelding een rapportageknop toe en laat de achtergrond-AI de oorzaak analyseren."
          className="w-full rounded-xl border bg-background p-3"
        />
        <button
          type="button"
          disabled={busy||!textAiPrompt.trim()||changes.length>0||!connected}
          onClick={()=>void action(executeTextAi)}
          className="w-full rounded-xl bg-violet-600 p-3 font-black text-white disabled:opacity-50"
        >{busy?'AI VOERT UIT…':'AI OPDRACHT UITVOEREN'}</button>
        {!connected&&<p className="text-sm text-muted-foreground">Koppel GitHub onder Koppelingen zodat de AI de actuele broncode kan lezen.</p>}
        {changes.length>0&&<p className="text-sm text-amber-500">Er staan al conceptwijzigingen klaar. Rond die eerst af voordat je een nieuwe tekstuitvoering start.</p>}
        {textAiResult&&<div className="space-y-3 rounded-xl border bg-background p-4">
          <div><b>{textAiResult.title}</b><p className="mt-1 whitespace-pre-wrap text-sm">{textAiResult.answer}</p></div>
          <p className="text-xs text-muted-foreground">Broncontext: {textAiResult.selectedFiles.join(', ')}</p>
          <p className="text-sm font-semibold">{textAiResult.changes.length} wijziging(en) staan in je concept.</p>
          <button type="button" onClick={()=>setTab('source')} className="rounded-xl border px-4 py-2 font-bold">CONCEPT CONTROLEREN</button>
        </div>}
      </div>


    </section>}
    {tab==='monitor'&&<section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4">
        <div><h2 className="text-xl font-black">AI foutherstel en diagnostiek</h2>
        <p className="text-sm text-muted-foreground">Door de app geregistreerde fouten en uploadbeveiliging. Automatisch vernieuwen na iedere minuut is voorzien voor CI-status; foutmeldingen kun je handmatig herladen.</p></div>
        <button type="button" disabled={busy} onClick={()=>void action(loadErrorReports)} className="rounded-xl border px-4 py-2">Fouten vernieuwen</button>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
        <input aria-label="Foutrapporten doorzoeken" value={logSearch} onChange={event=>setLogSearch(event.target.value)} placeholder="Zoek pagina, fout, ernst of status…" className="min-w-0 flex-1 rounded-xl border bg-background p-3"/>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyOpen} onChange={event=>setOnlyOpen(event.target.checked)}/> Alleen open</label>
        <span className="text-xs text-muted-foreground">{filteredReports.length} van {errorReports.length}</span>
      </div>
      <section className="space-y-3">
        {filteredReports.length===0&&<p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Geen overeenkomende foutrapporten in de geladen selectie.</p>}
        {filteredReports.map(report=><article key={report.id} className={`space-y-3 rounded-xl border p-4 ${report.status==='needs_maker'?'border-amber-500/50':''}`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><p className="font-bold">{report.error_name||'Fout'} · {report.route}</p><p className="mt-1 text-sm text-muted-foreground">{report.error_message}</p></div>
            <span className="rounded-full border px-2 py-1 text-xs font-black">{reportStatusLabel(report.status)}</span>
          </div>
          {report.ai_summary&&<p className="text-sm"><b>AI-diagnose:</b> {report.ai_summary}</p>}
          {report.maker_action&&<p className="rounded-lg border border-amber-500/30 p-3 text-sm"><b>Makeractie:</b> {report.maker_action}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={()=>{setSelectedErrorReport(environment==='main'?report.id:null);setTab('ai');setTextAiPrompt(recoveryPrompt(report));setTextAiResult(null);window.scrollTo({top:0,behavior:'smooth'})}} className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-bold text-white">AI OPLOSSEN</button>
            {environment==='main'&&<button type="button" disabled={busy} onClick={()=>void action(()=>resolveErrorReport(report.id))} className="rounded-lg border px-3 py-2 text-sm font-bold">OPGELOST MARKEREN</button>}
          </div>
        </article>)}
      </section>
      {securityAudit}
      <p className="text-xs text-muted-foreground">Bronnen: appfoutrapporten en gescande uploads. Een volledig platformlogboek inclusief Cloudflare trace-logs vereist nog een veilige, afzonderlijke loggingkoppeling.</p>
    </section>}
    {tab==='automations'&&environment==='main'&&<GodAutomationBuilder onPrepareAi={prepareAiFromBuilder}/>}
    {tab==='source'&&environment==='main'&&<div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-muted-foreground">Volledige broncode · {base.slice(0,8)||'laden…'} · {changes.length} conceptwijzigingen</p><div className="flex gap-2"><button onClick={exportDraft} disabled={!changes.length} className="rounded-xl border px-3 py-2 text-sm">Concept downloaden</button><button onClick={()=>uploadRef.current?.click()} className="rounded-xl border px-3 py-2 text-sm">Concept importeren</button><input ref={uploadRef} type="file" accept="application/json" hidden onChange={e=>{const file=e.target.files?.[0];if(file)void action(()=>importDraft(file));e.target.value=''}}/></div></div>
      <div className="grid min-w-0 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]"><aside className="space-y-3 rounded-xl border p-3"><input aria-label="Bestand zoeken" placeholder="Bestand of map zoeken…" value={search} onChange={e=>setSearch(e.target.value)} className="w-full rounded-lg border bg-background p-2 text-sm"/><div className="max-h-[55vh] overflow-auto">{Array.from(new Set([...files.map(f=>f.path),...Object.keys(drafts)])).filter(f=>f.toLowerCase().includes(search.toLowerCase())).sort().map(file=><button key={file} disabled={!base||busy} onClick={()=>void open(file)} className={`block w-full break-all rounded p-2 text-left font-mono text-xs ${path===file?'bg-violet-600 text-white':'hover:bg-muted'}`}>{Object.hasOwn(drafts,file)?'● ':''}{file}</button>)}</div><input aria-label="Nieuw bestandspad" placeholder="components/nieuwe-knop.tsx" value={newPath} onChange={e=>setNewPath(e.target.value)} className="w-full rounded-lg border bg-background p-2 text-xs"/><button disabled={busy||!base} onClick={addFile} className="w-full rounded-lg border p-2 text-sm font-bold">Bestand toevoegen</button></aside><section className="min-w-0 space-y-3">{path?<><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="break-all font-mono text-sm">{path}</h2><button disabled={busy} onClick={()=>{setDrafts(current=>({...current,[path]:null}));setMessage('Verwijdering staat klaar in je concept; pas definitief na publicatie.')}} className="rounded border border-red-500/50 px-3 py-2 text-xs text-red-500">Bestand verwijderen</button></div>{drafts[path]===null?<div className="rounded-xl border border-red-500 p-4">Bestand gemarkeerd voor verwijdering. <button onClick={()=>setDrafts(current=>{const next={...current};delete next[path];return next})} className="underline">Ongedaan maken</button></div>:<CodeEditor key={path} path={path} line={line} value={value} onChange={content=>setDrafts(current=>({...current,[path]:content}))} readOnly={busy||(!Object.hasOwn(originals,path)&&!Object.hasOwn(drafts,path))}/>}</>:<div className="grid min-h-80 place-items-center rounded-xl border border-dashed p-6 text-center text-muted-foreground">Open een bestand of kies een knop onder Knoppen & onderdelen.</div>}</section></div>
      <section className="space-y-3 rounded-xl border p-4"><h2 className="font-black">AI-programmeur</h2><p className="text-sm text-muted-foreground">De AI krijgt het geopende bestand en je gewijzigde bestanden. Open aanvullende bestanden en bewerk ze in het concept om die context mee te geven. Voorstellen worden nooit automatisch gepubliceerd.</p><textarea aria-label="Codeopdracht aan AI" rows={3} value={aiPrompt} onChange={e=>setAiPrompt(e.target.value)} placeholder="Voeg een knop toe die… / Verander deze workflow zodat…" className="w-full rounded-xl border bg-background p-3"/><button disabled={busy||!path||!aiPrompt.trim()} onClick={()=>void action(askAi)} className="rounded-xl bg-violet-600 px-4 py-2 font-bold text-white disabled:opacity-50">Codevoorstel maken</button>{aiReply&&<div className="space-y-3"><p className="whitespace-pre-wrap text-sm">{aiReply.answer}</p>{aiReply.changes.map(c=><details key={c.path} className="rounded border p-2"><summary>{c.content===null?'Verwijderen':'Wijzigen'}: {c.path}</summary><pre className="max-h-64 overflow-auto text-xs">{c.content??'Bestand verwijderen'}</pre></details>)}<button disabled={busy||!aiReply.changes.length} onClick={()=>void action(applyAi)} className="rounded border px-4 py-2">Voorstel in concept overnemen</button></div>}</section>
      {changes.length>0&&<section className="space-y-3 rounded-xl border border-amber-500/40 p-4"><h2 className="font-black">Wijzigingen controleren</h2>{changes.map(change=>{const diff=summarizeChanges(originals[change.path]||'',change.content||'');return <details key={change.path} className="rounded border p-3"><summary className="break-all font-mono text-xs">{change.content===null?'Verwijderen':files.some(f=>f.path===change.path)?'Wijzigen':'Toevoegen'} · {change.path}</summary><p className="mt-2 text-xs">Vanaf regel {diff.line}</p><pre className="max-h-60 overflow-auto text-xs text-red-400">{diff.removed.map(l=>'- '+l).join('\n')}</pre><pre className="max-h-60 overflow-auto text-xs text-green-400">{diff.added.map(l=>'+ '+l).join('\n')}</pre></details>})}<input aria-label="Beschrijving codewijziging" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Beschrijf wat je verandert" className="w-full rounded-xl border bg-background p-3"/><button disabled={busy||title.trim().length<3||!connected} onClick={()=>void action(save)} className="rounded-xl bg-violet-600 px-5 py-3 font-black text-white disabled:opacity-50">Concept opslaan & tests starten</button>{!connected&&<p className="text-sm">Verbind GitHub onder Koppelingen om code op te slaan.</p>}</section>}
    </div>}
    {tab==='elements'&&environment==='main'&&<section className="space-y-4"><h2 className="text-xl font-black">Van knop naar programmering</h2><p className="text-sm text-muted-foreground">Selecteer een knop, invoerveld, formulier of functie. De editor opent het bijbehorende bestand en de regel.</p><div className="flex flex-wrap gap-2"><input aria-label="Pagina inspecteren" value={previewPath} onChange={e=>setPreviewPath(e.target.value)} className="min-w-0 flex-1 rounded-xl border bg-background p-3"/><button onClick={()=>{if(!previewPath.startsWith('/')||previewPath.startsWith('//')||previewPath.startsWith('/god-mode')){setMessage('Gebruik een intern app-pad, bijvoorbeeld /events.');return}setPreview(previewPath)}} className="rounded-xl border px-4 py-2">Pagina inspecteren</button><select aria-label="Schermbreedte" value={previewWidth} onChange={e=>setPreviewWidth(e.target.value)} className="rounded-xl border bg-background p-2"><option value="100%">Desktop</option><option value="390px">Mobiel</option><option value="768px">Tablet</option></select></div>{preview&&<div className="overflow-auto rounded-xl border bg-zinc-950 p-2"><p className="p-2 text-xs text-zinc-400">Selectiestand: klikken selecteert een onderdeel. De pagina toont je huidige gewone app-sessie; meld daar eerst aan als dat nodig is.</p><iframe title="App onderdelen selecteren" src={preview} onLoad={e=>inspectFrame(e.currentTarget)} className="mx-auto h-[55vh] max-w-full bg-white" style={{width:previewWidth}}/></div>}<input aria-label="Onderdeel zoeken" value={elementSearch} onChange={e=>setElementSearch(e.target.value)} placeholder="Zoek knoptekst, functienaam of bestand…" className="w-full rounded-xl border bg-background p-3"/><div className="max-h-[65vh] space-y-2 overflow-auto">{indexed.map((t,i)=><button key={`${t.file}:${t.line}:${i}`} disabled={!base} onClick={()=>void open(t.file,t.line)} className="block w-full rounded-xl border p-3 text-left hover:border-violet-500"><span className="text-xs font-bold text-violet-400">{t.kind}</span><p className="break-words text-sm">{t.label||t.handler}</p><p className="mt-1 break-all font-mono text-xs text-muted-foreground">{t.file}:{t.line} {t.handler}</p></button>)}</div></section>}
    {tab==='data'&&environment==='main'&&<GodDataEditor/>}
    {tab==='sql'&&<GodSqlEditor environment={environment} key={environment}/>}
    {tab==='roles'&&environment==='main'&&<GodModeEditor/>}
    {tab==='versions'&&<section className="space-y-4"><h2 className="text-xl font-black">Versies, tests & publicatie</h2><p className="text-sm text-muted-foreground">Concept → automatische tests → publiceren op main → Cloudflare-build. Bij een mislukte build blijft de vorige appversie live. Databasewijzigingen staan los van broncodeherstel.</p><button disabled={busy} onClick={()=>void action(loadHistory)} className="rounded-xl border px-4 py-2">Status vernieuwen</button>{proposal&&<a href={proposal.url} target="_blank" rel="noreferrer" className="block text-violet-400 underline">Laatst opgeslagen voorstel #{proposal.number}</a>}{pulls.map(p=><article key={p.number} className="space-y-3 rounded-xl border p-4"><a href={p.html_url} target="_blank" rel="noreferrer" className="font-bold underline">#{p.number} {p.title}</a><p className="font-mono text-xs">{p.head.sha.slice(0,8)}</p><div className="flex flex-wrap gap-2"><button disabled={busy} onClick={()=>void action(async()=>{const data=await api<{runs:Run[]}>(`/api/god/source?action=checks&sha=${p.head.sha}`);setRuns(data.runs);setMessage(data.runs.length?'Teststatus geladen.':'Tests zijn nog niet gestart. Controleer de Actions-koppeling op GitHub.')})} className="rounded-xl border px-4 py-2">Tests bekijken</button><button disabled={busy||!connected} onClick={()=>void action(async()=>{const data=await api<{notice:string}>('/api/god/source',{action:'publish',number:p.number,sha:p.head.sha});setMessage(data.notice);await loadHistory();await load()})} className="rounded-xl bg-violet-600 px-4 py-2 font-bold text-white disabled:opacity-50">Geteste versie publiceren</button></div></article>)}{runs.map(r=><a key={r.id} href={r.html_url} target="_blank" rel="noreferrer" className="block rounded-xl border p-3 text-sm">{r.name}: {r.conclusion||r.status} · log openen</a>)}<h3 className="pt-3 font-black">Broncodegeschiedenis</h3>{history.map(c=><article key={c.sha} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><div><a href={c.html_url} target="_blank" rel="noreferrer" className="text-sm font-bold underline">{c.commit.message.split('\n')[0]}</a><p className="text-xs text-muted-foreground">{c.sha.slice(0,8)} · {new Date(c.commit.author.date).toLocaleString('nl-BE')}</p></div><button disabled={busy||!connected} onClick={()=>setRestore(c.sha)} className="rounded border px-3 py-2 text-xs">Herstelvoorstel</button></article>)}{restore&&<div className="space-y-2 rounded-xl border border-amber-500 p-4"><p>Broncode naar {restore.slice(0,8)} herstellen? Dit maakt een nieuw voorstel dat eerst getest moet worden. Gegevens worden niet teruggezet.</p><button disabled={busy} onClick={()=>void action(async()=>{const data=await api<{proposal:Proposal}>('/api/god/source',{action:'restore',target:restore,base});setProposal(data.proposal);setRestore('');await loadHistory()})} className="rounded bg-violet-600 px-4 py-2 text-white">Herstelvoorstel maken</button><button onClick={()=>setRestore('')} className="ml-2 rounded border px-4 py-2">Annuleren</button></div>}</section>}
    {tab==='connections'&&<section className="space-y-5"><h2 className="text-xl font-black">Schrijftoegang koppelen</h2><p className="text-sm text-muted-foreground">De app heeft eigen toegangsrechten nodig. Sleutels worden versleuteld bewaard en alleen op de server gebruikt. De chatkoppelingen worden niet automatisch aan de website doorgegeven.</p><div className="space-y-3 rounded-xl border p-4"><h3 className="font-bold">GitHub · {connected?'gekoppeld':'nog niet gekoppeld'}</h3><p className="text-sm">Maak een fine-grained token voor uitsluitend UpTillDawn-Crew, met Contents, Pull requests, Actions en Workflows op read/write.</p><a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer" className="block text-sm text-violet-400 underline">GitHub-toegang instellen</a><input aria-label="GitHub-toegangssleutel" type="password" autoComplete="off" value={credential} onChange={e=>setCredential(e.target.value)} placeholder="GitHub-token" className="w-full rounded-xl border bg-background p-3"/><div className="flex gap-2"><button disabled={busy||!credential} onClick={()=>void action(async()=>{await api('/api/god/connection',{credential});setCredential('');setConnected(true);setMessage('GitHub gekoppeld.')})} className="rounded-xl bg-violet-600 px-4 py-2 text-white">GitHub koppelen</button><button disabled={busy||!connected} onClick={()=>void action(async()=>{await api('/api/god/connection',undefined,'DELETE');setConnected(false)})} className="rounded-xl border px-4 py-2">Ontkoppelen</button></div></div><div className="space-y-3 rounded-xl border p-4"><h3 className="font-bold">SQL-werkruimte · {databaseConnected?'gekoppeld':'nog niet gekoppeld'}</h3><p className="text-sm">Gebruik een Supabase Management API-token met databasebevoegdheid voor dit project. Gewone gegevensbewerking werkt al met je God Mode-sessie.</p><a href="https://supabase.com/dashboard/account/tokens" target="_blank" rel="noreferrer" className="block text-sm text-violet-400 underline">Supabase-toegang instellen</a><input aria-label="Supabase Management API-sleutel" type="password" autoComplete="off" value={databaseKey} onChange={e=>setDatabaseKey(e.target.value)} placeholder="Supabase Management API-token" className="w-full rounded-xl border bg-background p-3"/><div className="flex gap-2"><button disabled={busy||!databaseKey} onClick={()=>void action(async()=>{await api('/api/god/sql',{action:'connect',credential:databaseKey});setDatabaseKey('');setDatabaseConnected(true);setMessage('SQL-werkruimte gekoppeld.')})} className="rounded-xl bg-violet-600 px-4 py-2 text-white">SQL koppelen</button><button disabled={busy||!databaseConnected} onClick={()=>void action(async()=>{await api('/api/god/sql',{action:'disconnect'});setDatabaseConnected(false)})} className="rounded-xl border px-4 py-2">Ontkoppelen</button></div></div></section>}
  </div>
}
