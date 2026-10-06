'use client'

import { useEffect, useState } from 'react'
import type { AutomationAction, AutomationTrigger } from '@/lib/automation-engine'
import { humanizeAppError } from '@/lib/client-error-message'

const triggers: {value:AutomationTrigger;label:string}[] = [
  {value:'shift-starting',label:'Shift start binnenkort'},
  {value:'shift-started',label:'Shift gestart'},
  {value:'shift-ended',label:'Shift beëindigd'},
  {value:'break-started',label:'Pauze gestart'},
  {value:'task-overdue',label:'Taak te laat'},
  {value:'briefing-updated',label:'Briefing gewijzigd'},
  {value:'incident-created',label:'Help/incident aangemaakt'},
  {value:'occupancy-changed',label:'Bezetting gewijzigd'},
  {value:'event-phase-changed',label:'Evenementfase gewijzigd'},
]

const actions: {value:AutomationAction;label:string}[] = [
  {value:'notify-user',label:'Melding naar medewerker'},
  {value:'notify-responsible',label:'Melding naar verantwoordelijke'},
  {value:'notify-admin',label:'Melding naar admin'},
  {value:'create-task',label:'Taak aanmaken'},
  {value:'reset-briefing-confirmation',label:'Briefingbevestiging resetten'},
  {value:'escalate-incident',label:'Incident escaleren'},
]

export function GodAutomationBuilder({
  onPrepareAi,
}:{
  onPrepareAi:(prompt:string,file?:string,line?:number)=>void
}) {
  const [name,setName]=useState('Nieuwe automatisatie')
  const [trigger,setTrigger]=useState<AutomationTrigger>('shift-starting')
  const [action,setAction]=useState<AutomationAction>('notify-user')
  const [delay,setDelay]=useState(0)
  const [eventScope,setEventScope]=useState('')
  const [workplaceScope,setWorkplaceScope]=useState('')
  const [condition,setCondition]=useState('')
  const [message,setMessage]=useState('')
  const [enabled,setEnabled]=useState(true)
  const [existingRules,setExistingRules]=useState<Array<{automation_key:string;label:string;description:string;enabled:boolean}>>([])
  const [loadingRules,setLoadingRules]=useState(true)
  const [ruleStatus,setRuleStatus]=useState('')

  useEffect(()=>{
    let active=true
    fetch('/api/god/automation-rules',{cache:'no-store'}).then(async response=>{
      const data=await response.json()
      if(!response.ok)throw new Error(humanizeAppError(data.error||'Automatiseringen konden niet worden geladen.'))
      if(active)setExistingRules(data.rules||[])
    }).catch(()=>{}).finally(()=>{if(active)setLoadingRules(false)})
    return()=>{active=false}
  },[])

  async function toggleRule(rule:{automation_key:string;enabled:boolean}){
    setRuleStatus('')
    const response=await fetch('/api/god/automation-rules',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({automation_key:rule.automation_key,enabled:!rule.enabled})})
    const data=await response.json()
    if(!response.ok){setRuleStatus(humanizeAppError(data.error||'Automatisering kon niet worden opgeslagen.'));return}
    setExistingRules(current=>current.map(item=>item.automation_key===rule.automation_key?{...item,enabled:!rule.enabled}:item))
    setRuleStatus('Automatisering opgeslagen.')
  }

  function prompt() {
    return [
      'Breid de bestaande automation-engine van Up Till Dawn uit met een configureerbare automatisering.',
      `Naam: ${name}.`,
      `Trigger: ${trigger}.`,
      `Actie: ${action}.`,
      `Vertraging: ${Math.max(0,delay)} minuten.`,
      eventScope?`Evenementscope: ${eventScope}.`:'',
      workplaceScope?`Werkplekscope: ${workplaceScope}.`:'',
      condition?`Extra voorwaarde: ${condition}.`:'',
      message?`Bericht/template: ${message}.`:'',
      `Standaard actief: ${enabled?'ja':'nee'}.`,
      'Maak dit persistent en bewerkbaar vanuit God Mode, met validatie, auditlogging en bestaande autorisatie. Gebruik de bestaande automation-engine in plaats van een tweede systeem. Voeg zo nodig een nieuwe Supabase-migratie en God Mode API toe. Laat bestaande automaties compatibel.',
    ].filter(Boolean).join(' ')
  }

  return <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
    <section className="space-y-4 rounded-2xl border p-5">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-400">Automation Builder</p>
        <h2 className="text-2xl font-black">Automaties maken en bewerken</h2>
        <p className="mt-1 text-sm text-muted-foreground">Stel trigger, actie, vertraging, scope en voorwaarden samen. God Mode zet dit om naar een controleerbaar code/databasevoorstel.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm">Naam<input value={name} onChange={e=>setName(e.target.value)} className="mt-1 w-full rounded-xl border bg-background p-3"/></label>
        <label className="text-sm">Status<select value={enabled?'on':'off'} onChange={e=>setEnabled(e.target.value==='on')} className="mt-1 w-full rounded-xl border bg-background p-3"><option value="on">Actief</option><option value="off">Uitgeschakeld</option></select></label>
        <label className="text-sm">Trigger<select value={trigger} onChange={e=>setTrigger(e.target.value as AutomationTrigger)} className="mt-1 w-full rounded-xl border bg-background p-3">{triggers.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label className="text-sm">Actie<select value={action} onChange={e=>setAction(e.target.value as AutomationAction)} className="mt-1 w-full rounded-xl border bg-background p-3">{actions.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label className="text-sm">Vertraging (minuten)<input type="number" min={0} value={delay} onChange={e=>setDelay(Number(e.target.value)||0)} className="mt-1 w-full rounded-xl border bg-background p-3"/></label>
        <label className="text-sm">Evenementscope<input value={eventScope} onChange={e=>setEventScope(e.target.value)} placeholder="Alle evenementen of event-id/regel" className="mt-1 w-full rounded-xl border bg-background p-3"/></label>
        <label className="text-sm">Werkplekscope<input value={workplaceScope} onChange={e=>setWorkplaceScope(e.target.value)} placeholder="Alle werkplekken of specifieke scope" className="mt-1 w-full rounded-xl border bg-background p-3"/></label>
        <label className="text-sm">Extra voorwaarde<input value={condition} onChange={e=>setCondition(e.target.value)} placeholder="bv. alleen als niemand is ingeklokt" className="mt-1 w-full rounded-xl border bg-background p-3"/></label>
      </div>

      <label className="block text-sm">Bericht / template<textarea rows={4} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Tekst of instructie voor de actie…" className="mt-1 w-full rounded-xl border bg-background p-3"/></label>

      <button onClick={()=>onPrepareAi(prompt(),'lib/automation-engine.ts',1)} className="rounded-xl bg-violet-600 px-5 py-3 font-black text-white">AI-implementatievoorstel maken</button>
    </section>

    <aside className="space-y-4">
      <section className="rounded-2xl border p-4">
        <p className="text-xs font-black uppercase tracking-wider text-violet-400">Samenvatting</p>
        <h3 className="mt-1 font-black">{name}</h3>
        <dl className="mt-3 space-y-2 text-sm">
          <div><dt className="text-muted-foreground">Wanneer</dt><dd>{triggers.find(x=>x.value===trigger)?.label}</dd></div>
          <div><dt className="text-muted-foreground">Dan</dt><dd>{actions.find(x=>x.value===action)?.label}</dd></div>
          <div><dt className="text-muted-foreground">Na</dt><dd>{delay} min</dd></div>
          <div><dt className="text-muted-foreground">Status</dt><dd>{enabled?'Actief':'Uitgeschakeld'}</dd></div>
        </dl>
      </section>

      <section className="rounded-2xl border p-4">
        <p className="text-xs font-black uppercase tracking-wider text-violet-400">Bestaande automaties</p>
        <p className="mt-2 text-sm text-muted-foreground">{loadingRules?'Automatiseringen laden…':existingRules.filter(rule=>rule.enabled).length+'/'+existingRules.length+' actief'}</p>
        <div className="mt-3 max-h-80 space-y-2 overflow-auto">{existingRules.map(rule=><article key={rule.automation_key} className="rounded-lg border p-3">
          <div className="flex items-start justify-between gap-2"><div><p className="text-sm font-bold">{rule.label}</p><p className="mt-1 text-xs text-muted-foreground">{rule.description}</p></div><span className="rounded-full border px-2 py-1 text-[10px] font-black">{rule.enabled?'ACTIEF':'UIT'}</span></div>
          <div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={()=>void toggleRule(rule)} className="rounded-lg border px-3 py-2 text-xs font-bold">{rule.enabled?'Uitschakelen':'Inschakelen'}</button><button type="button" onClick={()=>onPrepareAi('Pas de bestaande automation rule '+rule.automation_key+' aan. Behoud de bestaande automation-engine, auditlogging en autorisatie. Regel: '+rule.label+' — '+rule.description+'.','lib/automation-engine.ts',1)} className="rounded-lg border px-3 py-2 text-xs font-bold">Bewerken via AI</button></div>
        </article>)}</div>
        {ruleStatus&&<p role="status" className="mt-3 text-xs">{ruleStatus}</p>}
      </section>
    </aside>
  </div>
}
