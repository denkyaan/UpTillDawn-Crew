import {useEffect,useState} from "react"
import {useSession} from "../lib/session"
import {usePrivateQuery} from "../lib/use-private-query"
import type {WorkSession} from "../lib/operational-reads"
import {ownSessionBreaks,ownSessionTimeSummary,startOwnBreak,stopOwnBreak,type OwnBreak,type TimeSummary} from "../lib/break-operations"
import {MIGRATION_WRITES_ENABLED} from "../lib/operational-writes"
import {breakAlert,formatWorkDuration} from "../shared/break-clock"
import {timekeepingCopy} from "../shared/timekeeping-copy"
import {useLocale} from "../lib/use-locale"
import {Refresh,WhenLoading} from "./data-ui"

export default function BreakTracker({session}:{session:WorkSession}){
 const uid=useSession().identity!.id
 const {locale}=useLocale(),t=timekeepingCopy(locale)
 const id=session.id
 const [now,setNow]=useState(()=>Date.now())
 const [busy,setBusy]=useState(false)
 const [notice,setNotice]=useState("")
 const breaks=usePrivateQuery<OwnBreak[]>(uid,"own-breaks:"+id,signal=>ownSessionBreaks(uid,id,signal))
 const summary=usePrivateQuery<TimeSummary>(uid,"own-time-summary:"+id,signal=>ownSessionTimeSummary(id,signal))
 const active=session.ended_at===null
 const activeBreak=breaks.data?.find(b=>b.ended_at===null)||null
 useEffect(()=>{
  if(!active||!activeBreak)return
  const timer=window.setInterval(()=>{if(!document.hidden)setNow(Date.now())},60000)
  return()=>window.clearInterval(timer)
 },[active,activeBreak?.id])
 const alert=active&&activeBreak?breakAlert(activeBreak.started_at,now):"none"
 async function change(action:"start"|"stop"){
  if(!MIGRATION_WRITES_ENABLED||busy||!active||breaks.loading||Boolean(breaks.error))return
  if(action==="start"&&activeBreak)return
  if(action==="stop"&&!activeBreak)return
  setBusy(true);setNotice("")
  try{
   if(action==="start")await startOwnBreak(id)
   else await stopOwnBreak(activeBreak!.id)
   setNotice(t.breakDone)
  }catch{setNotice(t.breakError)}
  finally{breaks.refresh();summary.refresh();setNow(Date.now());setBusy(false)}
 }
 return <section className="card"><div className="row"><h2>{t.breakTitle}</h2>
  <Refresh onClick={()=>{breaks.refresh();summary.refresh();setNow(Date.now())}}/></div>
  <WhenLoading loading={breaks.loading} error={breaks.error}>
   <p>{activeBreak?t.breakActive:t.breakIdle}</p>
   {alert!=="none"&&<p role="status" className="notice">{alert==="five_minutes"?t.breakReminder:t.breakOver}</p>}
   {MIGRATION_WRITES_ENABLED&&active&&<button type="button" className="primary"
    disabled={busy||breaks.loading||Boolean(breaks.error)}
    onClick={()=>void change(activeBreak?"stop":"start")}>
    {busy?t.breakBusy:activeBreak?t.breakStop:t.breakStart}
   </button>}
  </WhenLoading>
  {notice&&<p role="status">{notice}</p>}
  <WhenLoading loading={summary.loading} error={summary.error}>
   {summary.data&&<><h3>{t.summary}</h3><dl>
    <dt>{t.gross}</dt><dd>{formatWorkDuration(summary.data.gross_seconds)}</dd>
    <dt>{t.pause}</dt><dd>{formatWorkDuration(summary.data.break_seconds)}</dd>
    <dt>{t.allowance}</dt><dd>{formatWorkDuration(summary.data.break_allowance_seconds)}</dd>
    <dt>{t.excess}</dt><dd>{formatWorkDuration(summary.data.excess_break_seconds)}</dd>
    <dt>{t.net}</dt><dd>{formatWorkDuration(summary.data.net_payable_seconds)}</dd>
   </dl></>}
  </WhenLoading>
  <p className="muted">{t.disclaimer}</p>
 </section>
}
