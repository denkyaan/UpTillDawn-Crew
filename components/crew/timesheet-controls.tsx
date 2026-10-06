'use client'
import {useState} from 'react'
import {createClient} from '@/lib/supabase/crew-client'

type Row={id:string;event_id:string;user_id:string;status:string;rejection_reason:string|null}
type Copy={title:string;mine:string;team:string;submit:string;resubmit:string;approve:string;reject:string;lock:string;reason:string;empty:string;working:string}
export default function TimesheetControls({eventId,userId,isAdmin,isResponsible,own,rows,copy}:{eventId:string;userId:string;isAdmin:boolean;isResponsible:boolean;own:Row|null;rows:Row[];copy:Copy}){
 const s=createClient();const [busy,setBusy]=useState(false);const [msg,setMsg]=useState('');const [reasons,setReasons]=useState<Record<string,string>>({})
 async function run(fn:()=>Promise<unknown>){setBusy(true);setMsg('');try{await fn();location.reload()}catch(e){setMsg(e instanceof Error?e.message:String(e));setBusy(false)}}
 async function submit(){await run(async()=>{const r=await s.rpc('upt_submit_timesheet',{p_event:eventId});if(r.error)throw r.error})}
 async function review(id:string,approve:boolean){await run(async()=>{const r=await s.rpc('upt_review_timesheet',{p_timesheet:id,p_approve:approve,p_reason:approve?undefined:(reasons[id]||'').trim()});if(r.error)throw r.error})}
 async function lock(id:string){await run(async()=>{const r=await s.rpc('upt_lock_timesheet',{p_timesheet:id});if(r.error)throw r.error})}
 return <div className="space-y-6">
  <section className="rounded-2xl border p-5"><h2 className="text-xl font-bold">{copy.mine}</h2><p className="mt-2 font-semibold" data-timesheet-own-status>{own?.status||'open'}</p>{own?.rejection_reason&&<p className="mt-2 text-sm">{own.rejection_reason}</p>}{(!own||own.status==='open'||own.status==='rejected')&&<button data-action="timesheet-submit" disabled={busy} onClick={submit} className="mt-4 rounded-xl bg-violet-600 px-4 py-3 font-bold text-white">{own?.status==='rejected'?copy.resubmit:copy.submit}</button>}</section>
  {(isAdmin||isResponsible)&&<section className="space-y-3"><h2 className="text-xl font-bold">{copy.team}</h2>{!rows.length&&<p>{copy.empty}</p>}{rows.filter(r=>r.user_id!==userId).map(r=><article key={r.id} data-timesheet-id={r.id} className="rounded-2xl border p-4"><p className="font-semibold">{r.user_id}</p><p>{r.status}</p>{r.status==='submitted'&&<><input aria-label={copy.reason} value={reasons[r.id]||''} onChange={e=>setReasons(x=>({...x,[r.id]:e.target.value}))} className="mt-3 w-full rounded-lg border bg-background p-3"/><div className="mt-3 flex gap-2"><button data-action="timesheet-approve" disabled={busy} onClick={()=>review(r.id,true)} className="rounded-lg bg-violet-600 p-3 font-bold text-white">{copy.approve}</button><button data-action="timesheet-reject" disabled={busy||!(reasons[r.id]||'').trim()} onClick={()=>review(r.id,false)} className="rounded-lg border p-3 font-bold">{copy.reject}</button></div></>}{isAdmin&&r.status==='approved'&&<button data-action="timesheet-lock" disabled={busy} onClick={()=>lock(r.id)} className="mt-3 rounded-lg border p-3 font-bold">{copy.lock}</button>}</article>)}</section>}
  {msg&&<p role="alert">{msg}</p>}
 </div>
}
