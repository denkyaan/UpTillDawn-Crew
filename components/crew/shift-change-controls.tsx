import {
  cancelShiftChange,
  claimOpenShift,
  decideShiftChange,
  requestShiftReplacement,
  requestShiftSwap,
  respondShiftChange,
} from '@/lib/actions/uptilldawn'
import { shiftChangeIsReadyForApproval, type ShiftChangeType } from '@/lib/shift-change-requests'

export type ShiftChangeRequestView={
  id:string
  type:ShiftChangeType
  shiftId:string
  targetShiftId:string|null
  requesterId:string
  requesterName:string
  replacementUserId:string|null
  replacementName:string|null
  status:'pending'|'approved'|'rejected'|'cancelled'
  replacementResponse:'pending'|'accepted'|'declined'|'not-required'
  reason:string
  decisionReason:string|null
  sourceScheduledStart:string
  sourceScheduledEnd:string
  sourceRoleName:string
  sourceWorkplaceName:string
  targetScheduledStart:string|null
  targetScheduledEnd:string|null
  targetRoleName:string|null
  targetWorkplaceName:string|null
  isStale:boolean
}

export type ShiftReplacementCandidate={
  userId:string
  fullName:string
}

export type ShiftSwapCandidate={
  targetShiftId:string
  userId:string
  fullName:string
  workplaceName:string
  roleName:string
  scheduledStart:string
  scheduledEnd:string
}

export type ClaimableShift={
  shiftId:string
  eventName:string
  workplaceName:string
  roleName:string
  shiftKind:string
  scheduledStart:string
  scheduledEnd:string
}

function typeLabel(type:ShiftChangeType){
  if(type==='swap')return 'RUIL'
  if(type==='replacement')return 'VERVANGING'
  return 'OPEN DIENST'
}

function statusLabel(row:ShiftChangeRequestView){
  if(row.status==='approved')return 'GOEDGEKEURD'
  if(row.status==='rejected')return 'AFGEWEZEN'
  if(row.status==='cancelled')return 'GEANNULEERD'
  if(row.isStale)return 'VEROUDERD'
  if(row.replacementResponse==='pending')return 'WACHT OP COLLEGA'
  return 'WACHT OP ADMIN'
}

function fmt(value:string){
  return new Date(value).toLocaleString('nl-BE')
}

export function ShiftChangeCenter({
  userId,
  isAdmin,
  requests,
  claimableShifts,
}:{
  userId:string
  isAdmin:boolean
  requests:ShiftChangeRequestView[]
  claimableShifts:ClaimableShift[]
}){
  const pending=requests.filter(row=>row.status==='pending')
  const recent=requests.filter(row=>row.status!=='pending').slice(0,6)
  if(!pending.length&&!recent.length&&!claimableShifts.length)return null

  return <section className="space-y-4 rounded-2xl border p-4">
    <div>
      <h2 className="text-xl font-black">Shiftwijzigingen</h2>
      <p className="text-sm text-muted-foreground">Vervanging, ruil en open diensten verlopen met expliciete bevestiging en Admin-goedkeuring.</p>
    </div>

    {pending.length>0&&<div className="space-y-3">
      <h3 className="text-sm font-black uppercase tracking-wide">Open aanvragen</h3>
      {pending.map(row=>{
        const nominee=row.replacementUserId===userId&&row.requesterId!==userId
        const ready=shiftChangeIsReadyForApproval({
          id:row.id,
          type:row.type,
          shiftId:row.shiftId,
          requesterId:row.requesterId,
          replacementUserId:row.replacementUserId,
          status:row.status,
          createdAt:0,
        })&&row.replacementResponse==='accepted'&&!row.isStale
        return <article key={row.id} className="space-y-3 rounded-xl border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-bold">{typeLabel(row.type)} · {row.sourceWorkplaceName}</p>
              <p className="text-sm text-muted-foreground">{fmt(row.sourceScheduledStart)} → {fmt(row.sourceScheduledEnd)} · {row.sourceRoleName}</p>
              <p className="mt-1 text-sm">{row.requesterName}{row.replacementName?' → '+row.replacementName:''}</p>
              {row.type==='swap'&&row.targetScheduledStart&&<p className="text-sm text-muted-foreground">Ruildienst: {row.targetWorkplaceName||'Werkplek'} · {fmt(row.targetScheduledStart)} → {fmt(row.targetScheduledEnd||row.targetScheduledStart)}</p>}
              <p className="mt-2 text-sm text-muted-foreground">Reden: {row.reason}</p>
              {row.decisionReason&&<p className="mt-1 text-sm text-muted-foreground">{row.decisionReason}</p>}
            </div>
            <span className="rounded-full border px-3 py-1 text-xs font-black">{statusLabel(row)}</span>
          </div>

          {nominee&&row.replacementResponse==='pending'&&!row.isStale&&<div className="grid gap-2 sm:grid-cols-2">
            <form action={respondShiftChange}>
              <input type="hidden" name="request_id" value={row.id}/>
              <input type="hidden" name="response" value="accepted"/>
              <button className="w-full rounded-lg bg-emerald-600 p-3 font-bold text-white">ACCEPTEREN</button>
            </form>
            <form action={respondShiftChange}>
              <input type="hidden" name="request_id" value={row.id}/>
              <input type="hidden" name="response" value="declined"/>
              <button className="w-full rounded-lg border border-red-500/50 p-3 font-bold text-red-600">WEIGEREN</button>
            </form>
          </div>}

          {row.requesterId===userId&&<form action={cancelShiftChange}>
            <input type="hidden" name="request_id" value={row.id}/>
            <button className="rounded-lg border px-3 py-2 text-sm font-bold">AANVRAAG ANNULEREN</button>
          </form>}

          {isAdmin&&<div className="grid gap-2 border-t pt-3 sm:grid-cols-2">
            <form action={decideShiftChange} className="grid gap-2">
              <input type="hidden" name="request_id" value={row.id}/>
              <input type="hidden" name="decision" value="approved"/>
              <button disabled={!ready} className="rounded-lg bg-violet-600 p-3 font-bold text-white disabled:opacity-40">GOEDKEUREN</button>
              {!ready&&<p className="text-xs text-muted-foreground">{row.isStale?'Planning is intussen gewijzigd.':'Wacht op bevestiging van de andere medewerker.'}</p>}
            </form>
            <form action={decideShiftChange} className="grid gap-2">
              <input type="hidden" name="request_id" value={row.id}/>
              <input type="hidden" name="decision" value="rejected"/>
              <input name="reason" required minLength={3} maxLength={500} placeholder="Reden afwijzing" className="rounded-lg border bg-background p-3"/>
              <button className="rounded-lg border border-red-500/50 p-3 font-bold text-red-600">AFWIJZEN</button>
            </form>
          </div>}
        </article>
      })}
    </div>}

    {!isAdmin&&claimableShifts.length>0&&<details className="rounded-xl border p-3">
      <summary className="cursor-pointer font-semibold">Open diensten ({claimableShifts.length})</summary>
      <div className="mt-3 space-y-3">
        {claimableShifts.map(shift=><article key={shift.shiftId} className="rounded-lg border p-3">
          <p className="font-bold">{shift.eventName} · {shift.workplaceName}</p>
          <p className="text-sm text-muted-foreground">{fmt(shift.scheduledStart)} → {fmt(shift.scheduledEnd)} · {shift.roleName}</p>
          <form action={claimOpenShift} className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input type="hidden" name="shift_id" value={shift.shiftId}/>
            <input name="reason" required minLength={3} maxLength={500} defaultValue="Ik ben beschikbaar voor deze dienst." className="rounded-lg border bg-background p-3"/>
            <button className="rounded-lg bg-violet-600 px-4 py-3 font-bold text-white">DIENST CLAIMEN</button>
          </form>
        </article>)}
      </div>
    </details>}

    {recent.length>0&&<details className="rounded-xl border p-3">
      <summary className="cursor-pointer font-semibold">Recente beslissingen</summary>
      <div className="mt-3 space-y-2">
        {recent.map(row=><div key={row.id} className="rounded-lg border p-3 text-sm">
          <div className="flex flex-wrap justify-between gap-2">
            <span className="font-semibold">{typeLabel(row.type)} · {row.sourceWorkplaceName}</span>
            <span className="font-bold">{statusLabel(row)}</span>
          </div>
          <p className="text-muted-foreground">{row.requesterName}{row.replacementName?' → '+row.replacementName:''}</p>
          {row.decisionReason&&<p className="mt-1 text-muted-foreground">{row.decisionReason}</p>}
        </div>)}
      </div>
    </details>}
  </section>
}

export function OwnShiftChangeControls({
  shiftId,
  replacementCandidates,
  swapCandidates,
  hasOpenRequest,
}:{
  shiftId:string
  replacementCandidates:ShiftReplacementCandidate[]
  swapCandidates:ShiftSwapCandidate[]
  hasOpenRequest:boolean
}){
  if(hasOpenRequest)return <p className="mt-3 rounded-lg border p-3 text-sm text-muted-foreground">Er staat al een wijzigingsaanvraag open voor deze dienst.</p>
  if(!replacementCandidates.length&&!swapCandidates.length)return null

  return <details className="mt-3 rounded-lg border p-3">
    <summary className="cursor-pointer text-sm font-semibold">Vervanging of ruil aanvragen</summary>
    <div className="mt-3 grid gap-4 lg:grid-cols-2">
      {replacementCandidates.length>0&&<form action={requestShiftReplacement} className="grid gap-2 rounded-lg border p-3">
        <p className="font-semibold">Vervanging</p>
        <input type="hidden" name="shift_id" value={shiftId}/>
        <select name="replacement_user_id" required className="rounded-lg border bg-background p-3">
          <option value="">Collega…</option>
          {replacementCandidates.map(candidate=><option key={candidate.userId} value={candidate.userId}>{candidate.fullName}</option>)}
        </select>
        <textarea name="reason" required minLength={3} maxLength={500} placeholder="Waarom heb je vervanging nodig?" className="min-h-20 rounded-lg border bg-background p-3"/>
        <button className="rounded-lg border p-3 font-bold">VERVANGING AANVRAGEN</button>
      </form>}

      {swapCandidates.length>0&&<form action={requestShiftSwap} className="grid gap-2 rounded-lg border p-3">
        <p className="font-semibold">Dienst ruilen</p>
        <input type="hidden" name="shift_id" value={shiftId}/>
        <select name="target_shift_id" required className="rounded-lg border bg-background p-3">
          <option value="">Ruildienst…</option>
          {swapCandidates.map(candidate=><option key={candidate.targetShiftId} value={candidate.targetShiftId}>
            {candidate.fullName} · {candidate.workplaceName} · {new Date(candidate.scheduledStart).toLocaleString('nl-BE')}
          </option>)}
        </select>
        <select name="replacement_user_id" required className="rounded-lg border bg-background p-3">
          <option value="">Bevestig collega…</option>
          {[...new Map(swapCandidates.map(candidate=>[candidate.userId,candidate.fullName])).entries()].map(([userId,fullName])=><option key={userId} value={userId}>{fullName}</option>)}
        </select>
        <textarea name="reason" required minLength={3} maxLength={500} placeholder="Waarom wil je ruilen?" className="min-h-20 rounded-lg border bg-background p-3"/>
        <p className="text-xs text-muted-foreground">De gekozen ruildienst moet van dezelfde collega zijn; dit wordt server-side opnieuw gecontroleerd.</p>
        <button className="rounded-lg border p-3 font-bold">RUIL AANVRAGEN</button>
      </form>}
    </div>
  </details>
}
