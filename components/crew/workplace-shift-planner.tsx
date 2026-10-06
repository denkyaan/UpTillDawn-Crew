import {DateInput} from '@/components/crew/date-input'
import {assignAvailableCrewShift,cancelShift,confirmShift,declineShift,reassignShift,updateShift} from '@/lib/actions/uptilldawn'
import { OwnShiftChangeControls, type ShiftReplacementCandidate, type ShiftSwapCandidate } from '@/components/crew/shift-change-controls'
import {WorkplaceTourButton} from '@/components/crew/workplace-tour-button'
import {DriverTransportForm} from '@/components/crew/driver-transport-form'

export type WorkplacePlannerPerson={
 id:string
 fullName:string
 eventAvailable:boolean
 setupAvailable:boolean
 breakdownAvailable:boolean
}

export type WorkplacePlannerShift={
 id:string
 workplaceId:string
 userId:string
 roleName:string
 shiftKind:'event'|'setup'|'breakdown'
 scheduledStart:string
 scheduledEnd:string
 status:string
 responseStatus:string
 responseReason?:string|null
 confirmedAt?:string|null
 overlapAllowed:boolean
}

export function WorkplaceShiftPlanner({
 workplaceId,
 eventId,
 isAdmin,
 currentUserId,
 defaultStart,
 defaultEnd,
 workplaceName,
 people,
 shifts,
 replacementCandidatesByShift,
 swapCandidatesByShift,
 openRequestShiftIds,
 driverArtists=[],
}:{
 workplaceId:string
 eventId:string
 isAdmin:boolean
 currentUserId:string
 defaultStart?:string
 defaultEnd?:string
 workplaceName:string
 people:WorkplacePlannerPerson[]
 shifts:WorkplacePlannerShift[]
 replacementCandidatesByShift:Map<string,ShiftReplacementCandidate[]>
 swapCandidatesByShift:Map<string,ShiftSwapCandidate[]>
 openRequestShiftIds:string[]
 driverArtists?:Array<{id:string;name:string}>
}){
 const nameById=new Map(people.map(person=>[person.id,person.fullName]))

 return <section className="rounded-xl border p-3">
  <div className="flex flex-wrap items-center justify-between gap-2">
   <div>
    <p className="font-semibold">Planning & diensten</p>
    <p className="text-xs text-muted-foreground">Personeel, werkuren en rol rechtstreeks aan deze werkplaats koppelen.</p>
   </div>
   <span className="rounded-full border px-2 py-1 text-xs font-bold">{shifts.length} DIENST{shifts.length===1?'':'EN'}</span>
  </div>

  {isAdmin&&<details className="mt-3 rounded-lg border border-violet-500/30 p-3">
   <summary className="cursor-pointer font-semibold">Personeel + uren toevoegen</summary>
   <form action={assignAvailableCrewShift} className="mt-3 grid gap-2 md:grid-cols-2">
    <input type="hidden" name="event_id" value={eventId}/>
    <input type="hidden" name="workplace_id" value={workplaceId}/>
    <select name="user_id" required className="rounded-lg border bg-background p-3">
     <option value="">Personeelslid…</option>
     {people.map(person=><option key={person.id} value={person.id}>
      {person.fullName} · {[
       person.eventAvailable?'event':null,
       person.setupAvailable?'opbouw':null,
       person.breakdownAvailable?'afbouw':null,
      ].filter(Boolean).join('/')||'geen beschikbaarheid'}
     </option>)}
    </select>
    {/bar|toog/i.test(workplaceName)
     ? <select name="role_name" required defaultValue="" className="rounded-lg border bg-background p-3">
        <option value="">Positie…</option>
        <option value="Bar">Bar</option>
        <option value="Toog">Toog</option>
       </select>
     : <input name="role_name" defaultValue="Personeel" maxLength={200} className="rounded-lg border bg-background p-3"/>}
    <select name="shift_kind" defaultValue="event" className="rounded-lg border bg-background p-3">
     <option value="event">Evenement</option>
     <option value="setup">Opbouw</option>
     <option value="breakdown">Afbouw</option>
    </select>
    <label className="flex items-center gap-2 rounded-lg border px-3">
     <input type="checkbox" name="overlap_allowed"/> Overlap toestaan
    </label>
    <DateInput name="start" initial={defaultStart}/>
    <DateInput name="end" initial={defaultEnd}/>
    <button className="rounded-lg bg-violet-600 p-3 font-bold text-white md:col-span-2">PERSONEEL & UREN TOEVOEGEN</button>
   </form>
  </details>}

  {!people.length&&isAdmin&&<p className="mt-3 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Nog niemand heeft beschikbaarheid voor dit evenement aangeduid.</p>}

  <div className="mt-3 space-y-2">
   {shifts.map(shift=><article key={shift.id} className="rounded-lg border p-3">
    <div className="flex flex-wrap items-start justify-between gap-3">
     <div>
      <p className="font-semibold">{nameById.get(shift.userId)||'Personeelslid'}</p>
      <p className="text-sm text-muted-foreground">
       {new Date(shift.scheduledStart).toLocaleString('nl-BE')} → {new Date(shift.scheduledEnd).toLocaleString('nl-BE')}
      </p>
      <p className="text-xs text-muted-foreground">
       {shift.shiftKind==='setup'?'Opbouw':shift.shiftKind==='breakdown'?'Afbouw':'Evenement'} · {shift.roleName}
      </p>
     </div>
     <div className="flex flex-wrap gap-2">
      <span className="rounded-full border px-2 py-1 text-xs font-bold">{shift.status.toUpperCase()}</span>
      <span className="rounded-full border px-2 py-1 text-xs font-bold">{shift.responseStatus==='accepted'?'BEVESTIGD':shift.responseStatus==='declined'?'GEWEIGERD':'WACHT OP REACTIE'}</span>
     </div>
    </div>

    {shift.userId===currentUserId&&shift.status!=='cancelled'&&<div className="mt-3 space-y-2">
     <WorkplaceTourButton workplaceName={workplaceName} roleName={shift.roleName}/>
     {shift.responseStatus==='accepted'&&shift.confirmedAt
      ? <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm font-semibold">SHIFT BEVESTIGD</p>
      : shift.responseStatus==='declined'
        ? <div className="space-y-2 rounded-lg border border-red-500/40 bg-red-500/5 p-3">
            <p className="text-sm font-semibold text-red-600">SHIFT GEWEIGERD</p>
            {shift.responseReason&&<p className="text-sm text-muted-foreground">{shift.responseReason}</p>}
            <form action={confirmShift}>
             <input type="hidden" name="shift_id" value={shift.id}/>
             <button className="w-full rounded-lg border p-3 font-bold">ALSNOCH BEVESTIGEN</button>
            </form>
          </div>
        : <div className="space-y-2">
            <form action={confirmShift}>
             <input type="hidden" name="shift_id" value={shift.id}/>
             <button className="w-full rounded-lg bg-violet-600 p-3 font-bold text-white">SHIFT BEVESTIGEN</button>
            </form>
            <details className="rounded-lg border p-3">
             <summary className="cursor-pointer text-sm font-semibold">Ik kan deze dienst niet uitvoeren</summary>
             <form action={declineShift} className="mt-3 grid gap-2">
              <input type="hidden" name="shift_id" value={shift.id}/>
              <textarea name="reason" required minLength={3} maxLength={500} placeholder="Reden van weigering" className="rounded-lg border bg-background p-3"/>
              <button className="rounded-lg border border-red-500/50 p-3 font-bold text-red-600">DIENST WEIGEREN</button>
             </form>
            </details>
          </div>}
    </div>}

    {!isAdmin&&shift.userId===currentUserId&&shift.status!=='cancelled'&&shift.responseStatus!=='declined'&&<OwnShiftChangeControls
      shiftId={shift.id}
      replacementCandidates={replacementCandidatesByShift.get(shift.id)||[]}
      swapCandidates={swapCandidatesByShift.get(shift.id)||[]}
      hasOpenRequest={openRequestShiftIds.includes(shift.id)}
    />}

    {isAdmin&&shift.status!=='cancelled'&&/driver/i.test(workplaceName)&&<DriverTransportForm shiftId={shift.id} artists={driverArtists}/>}

    {isAdmin&&shift.status!=='cancelled'&&<details className="mt-3 rounded-lg border p-3">
     <summary className="cursor-pointer text-sm font-semibold">Dienst bewerken</summary>
     <form action={updateShift} className="mt-3 grid gap-2 md:grid-cols-2">
      <input type="hidden" name="shift_id" value={shift.id}/>
      {/bar|toog/i.test(workplaceName)
       ? <select name="role_name" required defaultValue={shift.roleName} className="rounded-lg border bg-background p-3">
          <option value="Bar">Bar</option>
          <option value="Toog">Toog</option>
         </select>
       : <input name="role_name" required maxLength={200} defaultValue={shift.roleName} className="rounded-lg border bg-background p-3"/>}
      <select name="shift_kind" defaultValue={shift.shiftKind} className="rounded-lg border bg-background p-3">
       <option value="event">Evenement</option>
       <option value="setup">Opbouw</option>
       <option value="breakdown">Afbouw</option>
      </select>
      <DateInput name="start" initial={shift.scheduledStart}/>
      <DateInput name="end" initial={shift.scheduledEnd}/>
      <label className="flex items-center gap-2"><input type="checkbox" name="overlap_allowed" defaultChecked={shift.overlapAllowed}/> Overlap toestaan</label>
      <button className="rounded-lg border p-3 font-bold">DIENST OPSLAAN</button>
     </form>
     <div className="mt-3 border-t pt-3">
      <p className="text-sm font-semibold">Personeelslid herplannen</p>
      <form action={reassignShift} className="mt-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
       <input type="hidden" name="shift_id" value={shift.id}/>
       <select name="user_id" required className="rounded-lg border bg-background p-3">
        <option value="">Nieuw personeelslid…</option>
        {people.filter(person=>person.id!==shift.userId).map(person=><option key={person.id} value={person.id}>{person.fullName}</option>)}
       </select>
       <input name="reason" required minLength={3} maxLength={500} placeholder="Reden herplanning" className="rounded-lg border bg-background p-3"/>
       <button className="rounded-lg border px-4 py-3 font-bold">HERPLAN DIENST</button>
      </form>
     </div>
     <form action={cancelShift} className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
      <input type="hidden" name="shift_id" value={shift.id}/>
      <input name="reason" maxLength={500} placeholder="Reden annulering (optioneel)" className="rounded-lg border bg-background p-3"/>
      <button className="rounded-lg border border-red-500/50 px-4 py-3 font-bold text-red-600">DIENST ANNULEREN</button>
     </form>
    </details>}
   </article>)}
   {!shifts.length&&<p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Nog geen diensten ingepland voor deze werkplaats.</p>}
  </div>
 </section>
}
