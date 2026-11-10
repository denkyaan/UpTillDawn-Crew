'use client'
import {useState,useSyncExternalStore} from 'react'
import { showSaveSuccess } from '@/lib/client-save-success'
import { humanizeAppError } from '@/lib/client-error-message'
import {LANGUAGE_APPLIED_EVENT,initialUiLocale,parseUiLocale,type SupportedUiLocale} from '@/lib/locale-preferences'

const templates = [
  {name:'Workflowfuncties bekijken',sql:"select p.oid::regprocedure as functie, pg_get_functiondef(p.oid) as code\nfrom pg_proc p join pg_namespace n on n.oid=p.pronamespace\nwhere n.nspname='public' and p.prokind='f' and p.proname like 'upt_%'\norder by p.proname;"},
  {name:'Automatische triggers bekijken',sql:"select event_object_table as tabel, trigger_name, event_manipulation as gebeurtenis, action_statement as actie\nfrom information_schema.triggers where trigger_schema='public'\norder by event_object_table,trigger_name;"},
  {name:'Geplande automatiseringen bekijken',sql:'select jobid,schedule,command,active from cron.job order by jobid;'},
  {name:'God Mode wijzigingenlog',sql:'select * from upt_private.god_data_audit order by changed_at desc limit 100;'},
]

const localized={
 nl:{main:'MAIN-TEST: controleer functies en automatiseringen. Wijzigingen raken productie niet.',production:'PRODUCTIE: live database. Alleen jouw expliciet bevestigde SQL-opdrachten mogen schrijven; wijzigingen worden niet teruggedraaid bij broncodeherstel.',approvalMain:'Ik heb deze SQL gecontroleerd en bevestig een wijziging aan main-test.',approvalProduction:'Ik heb deze SQL gecontroleerd en bevestig een wijziging aan de LIVE productiedatabase.',confirmation:'Typ PRODUCTION om de live databasewijziging te bevestigen',code:'PRODUCTION'},
 fr:{main:'MAIN-TEST : examinez les fonctions et automatisations. La production ne change pas.',production:'PRODUCTION : base active. Les écritures nécessitent votre confirmation explicite ; un retour arrière du code ne les annule pas.',approvalMain:'Je confirme cette modification SQL de main-test.',approvalProduction:'Je confirme cette modification de la base LIVE.',confirmation:'Saisissez PRODUCTION pour confirmer une modification en direct',code:'PRODUCTION'},
 en:{main:'MAIN-TEST: inspect functions and automation. Production remains untouched.',production:'PRODUCTION: live database. SQL writes require your explicit confirmation; source-code rollback does not undo database changes.',approvalMain:'I reviewed this SQL and approve changing main-test.',approvalProduction:'I reviewed this SQL and approve changing the LIVE production database.',confirmation:'Type PRODUCTION to confirm this live database change',code:'PRODUCTION'},
 de:{main:'MAIN-TEST: Funktionen und Automationen prüfen. Produktion bleibt unverändert.',production:'PRODUKTION: Live-Datenbank. SQL-Schreibzugriffe erfordern deine ausdrückliche Bestätigung; ein Code-Rollback setzt Datenänderungen nicht zurück.',approvalMain:'Ich habe dieses SQL geprüft und bestätige die Änderung an main-test.',approvalProduction:'Ich habe dieses SQL geprüft und bestätige die Änderung an der LIVE-Datenbank.',confirmation:'Tippe PRODUCTION zur Bestätigung dieser Live-Änderung',code:'PRODUCTION'},
} as const
export function GodSqlEditor({environment='main'}:{environment?:'main'|'production'}){
  const locale=useSyncExternalStore(
    notify=>{window.addEventListener(LANGUAGE_APPLIED_EVENT,notify);return()=>window.removeEventListener(LANGUAGE_APPLIED_EVENT,notify)},
    ()=>parseUiLocale(document.documentElement.lang)||initialUiLocale(),
    ()=>'nl' as SupportedUiLocale,
  )
  const t=localized[locale]
  const inProduction=environment==='production'
  const [sql,setSql]=useState(templates[0].sql)
  const [write,setWrite]=useState(false)
  const [confirmed,setConfirmed]=useState(false)
  const [productionConfirmation,setProductionConfirmation]=useState('')
  const [busy,setBusy]=useState(false)
  const [result,setResult]=useState('')
  async function run(){
    if(busy)return
    setBusy(true);setResult('')
    try{
      const response=await fetch('/api/god/sql',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'query',query:sql,write,environment,...(write&&inProduction?{productionConfirmation}:{})})})
      const data=await response.json()
      if(!response.ok)throw new Error(humanizeAppError(data.error))
      setResult(JSON.stringify(data.data,null,2));setConfirmed(false);setProductionConfirmation('')
      if(write)showSaveSuccess()
    }catch(error){setResult(humanizeAppError(error))}
    finally{setBusy(false)}
  }
  return <section className="space-y-4"><h2 className="text-xl font-black">Logica, workflows & SQL</h2><p className="text-sm text-muted-foreground">Open de bestaande functies en triggers, wijzig hun SQL of voeg nieuwe functies, tabellen en automatiseringen toe. {inProduction?t.production:t.main} Een broncodeherstel draait databasewijzigingen niet terug.</p><div className="flex flex-wrap gap-2">{templates.map(t=><button key={t.name} onClick={()=>{setSql(t.sql);setConfirmed(false)}} className="rounded-xl border px-3 py-2 text-sm">{t.name}</button>)}</div><textarea aria-label="SQL-programmering" rows={22} value={sql} spellCheck={false} onChange={e=>{setSql(e.target.value);setConfirmed(false)}} className="w-full rounded-xl border bg-background p-3 font-mono text-sm"/><label className="flex items-center gap-2"><input type="checkbox" checked={write} onChange={e=>{setWrite(e.target.checked);setConfirmed(false);setProductionConfirmation('')}}/> Schrijven en structuurwijzigingen toestaan</label>{write&&<label className="flex items-start gap-2 rounded-xl border border-amber-500/50 p-3 text-sm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> {inProduction?t.approvalProduction:t.approvalMain}</label>}{write&&inProduction&&<label className="grid gap-1 rounded-xl border border-red-500/50 p-3 text-sm"><span>{t.confirmation}</span><input aria-label={t.confirmation} value={productionConfirmation} onChange={e=>setProductionConfirmation(e.target.value)} placeholder={t.code} className="rounded-lg border bg-background p-2 font-mono"/></label>}<button disabled={busy||!sql.trim()||(write&&!confirmed)||(write&&inProduction&&productionConfirmation!=='PRODUCTION')} onClick={()=>void run()} className="rounded-xl bg-violet-600 px-5 py-3 font-bold text-white disabled:opacity-50">{busy?'UITVOEREN…':write?'WIJZIGING UITVOEREN':'ALLEEN LEZEN UITVOEREN'}</button>{result&&<pre role="status" className="max-h-[60vh] overflow-auto rounded-xl border p-3 text-xs">{result}</pre>}</section>
}
