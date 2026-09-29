import {saveAutomationRule} from '@/lib/actions/platform'
import {PendingSubmitButton} from '@/components/ui/pending-submit-button'

export type AutomationRuleView={
  automation_key:string
  label:string
  description:string
  enabled:boolean
  trigger_key:string
  action_key:string
  delay_minutes:number
  reminder_minutes:number|null
  escalation_minutes:number|null
  audience:string
  channels:string[]
  auto_action:boolean
  audit_enabled:boolean
  cooldown_minutes:number
  max_retries:number
  last_run_at:string|null
  settings:unknown
}

const triggerLabel=(value:string)=>({
  'shift_starting':'Shift start binnenkort',
  'break_started':'Pauze gestart',
  'runtime_check':'Live operationele controle',
  'incident_created':'Help/incident aangemaakt',
  'platform_check':'Periodieke kwaliteitscontrole',
  'data_check':'Datacontrole',
  'account_pending':'Account wacht op goedkeuring',
  'event_starting':'Evenement nadert',
  'event_ended':'Evenement afgelopen',
}[value]||value.replaceAll('_',' '))

const actionLabel=(value:string)=>({
  'notify_user':'Melding naar medewerker',
  'notify_admin':'Melding naar admin',
  'notify_responsible':'Melding naar verantwoordelijke',
  'create_alert':'Waarschuwing aanmaken',
  'escalate_incident':'Incident escaleren',
}[value]||value.replaceAll('_',' '))

export function AutomationManager({rules}:{rules:AutomationRuleView[]}){
  return <section className="space-y-4 rounded-2xl border p-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-black uppercase tracking-[.2em] text-violet-400">AUTOMATION ENGINE</p>
        <h2 className="text-2xl font-black">Automatiseringen</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Beheer automatische controles, reminders en escalaties vanuit één plaats. Kritieke beslissingen zoals accountgoedkeuring, financiële correcties en verwijderingen blijven altijd handmatig.</p>
      </div>
      <span className="rounded-full border px-3 py-2 text-xs font-black">{rules.filter(rule=>rule.enabled).length}/{rules.length} actief</span>
    </div>

    <div className="grid gap-3 xl:grid-cols-2">
      {rules.map(rule=>{
        const settings=rule.settings&&typeof rule.settings==='object'&&!Array.isArray(rule.settings)?rule.settings as Record<string,unknown>:{}
        const managed=settings.managed==='built_in'?'built_in':'workflow'
        return <form key={rule.automation_key} action={saveAutomationRule} className="space-y-3 rounded-xl border p-4">
        <input type="hidden" name="automation_key" value={rule.automation_key}/>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-black">{rule.label}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{rule.description}</p>
          </div>
          <label className="flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold">
            <input name="enabled" type="checkbox" defaultChecked={rule.enabled}/> Actief
          </label>
        </div>

        <div className="grid gap-2 rounded-xl bg-muted/20 p-3 text-xs sm:grid-cols-2">
          <p><span className="text-muted-foreground">Trigger:</span> <b>{triggerLabel(rule.trigger_key)}</b></p>
          <p><span className="text-muted-foreground">Actie:</span> <b>{actionLabel(rule.action_key)}</b></p>
          <p><span className="text-muted-foreground">Doelgroep:</span> <b>{rule.audience}</b></p>
          <p><span className="text-muted-foreground">Laatste controle:</span> <b>{rule.last_run_at?new Date(rule.last_run_at).toLocaleString('nl-BE'):'Nog niet gecontroleerd'}</b></p>
        </div>

        {managed==='workflow'
          ? <details className="rounded-xl border p-3">
              <summary className="cursor-pointer font-semibold">Timing & leveringsregels aanpassen</summary>
              <p className="mt-2 text-xs text-muted-foreground">Vertraging bepaalt wanneer deze workflow voor het eerst actief wordt. Cooldown voorkomt onnodige herhaling. Pushmeldingen worden alleen geleverd wanneer de gebruiker push heeft toegestaan.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-xs">Vertraging (min)
                  <input name="delay_minutes" type="number" min="0" max="43200" defaultValue={rule.delay_minutes} className="rounded-lg border bg-background p-2"/>
                </label>
                <label className="grid gap-1 text-xs">Reminder (min)
                  <input name="reminder_minutes" type="number" min="1" max="43200" defaultValue={rule.reminder_minutes??''} placeholder="Niet gebruikt" className="rounded-lg border bg-background p-2"/>
                </label>
                <label className="grid gap-1 text-xs">Escalatie (min)
                  <input name="escalation_minutes" type="number" min="1" max="43200" defaultValue={rule.escalation_minutes??''} placeholder="Niet gebruikt" className="rounded-lg border bg-background p-2"/>
                </label>
                <label className="grid gap-1 text-xs">Cooldown (min)
                  <input name="cooldown_minutes" type="number" min="0" max="43200" defaultValue={rule.cooldown_minutes} className="rounded-lg border bg-background p-2"/>
                </label>
                <label className="grid gap-1 text-xs">Max. retries
                  <input name="max_retries" type="number" min="0" max="20" defaultValue={rule.max_retries} className="rounded-lg border bg-background p-2"/>
                </label>
                <fieldset className="rounded-lg border p-2">
                  <legend className="px-1 text-xs">Meldingskanalen</legend>
                  <div className="flex flex-wrap gap-3 text-xs">
                    <label className="flex items-center gap-1"><input type="checkbox" name="channel" value="in_app" defaultChecked={rule.channels.includes('in_app')}/> In-app</label>
                    <label className="flex items-center gap-1"><input type="checkbox" name="channel" value="push" defaultChecked={rule.channels.includes('push')}/> Push</label>
                  </div>
                </fieldset>
              </div>
            </details>
          : <div className="rounded-xl border p-3 text-xs text-muted-foreground">
              <b className="text-foreground">Beveiligde operationele automatisering.</b> De timing wordt door de operationele policy bewaakt. Hier kun je de automatisering veilig aan- of uitzetten; thresholds worden niet misleidend als vrije instelling aangeboden.
              <input type="hidden" name="delay_minutes" value={rule.delay_minutes}/>
              <input type="hidden" name="reminder_minutes" value={rule.reminder_minutes??''}/>
              <input type="hidden" name="escalation_minutes" value={rule.escalation_minutes??''}/>
              <input type="hidden" name="cooldown_minutes" value={rule.cooldown_minutes}/>
              <input type="hidden" name="max_retries" value={rule.max_retries}/>
              {rule.channels.map(channel=><input key={channel} type="hidden" name="channel" value={channel}/>)}
            </div>}

</details>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{rule.audit_enabled?'Uitvoeringen worden gededupliceerd en gelogd.':'Audit uitgeschakeld.'} {rule.auto_action?'Automatische actie toegestaan.':'Geen destructieve automatische actie.'}</p>
          <PendingSubmitButton pendingLabel="OPSLAAN…" className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-black text-white">AUTOMATISERING OPSLAAN</PendingSubmitButton>
        </div>
      </form>})}
    </div>
  </section>
}
