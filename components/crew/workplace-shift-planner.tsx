import {DateInput} from '@/components/crew/date-input'
import {assignAvailableCrewShift,cancelShift,updateShift} from '@/lib/actions/uptilldawn'

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
 overlapAllowed:boolean
}

export function WorkplaceShiftPlanner({
 workplaceId,
 eventId,
 isAdmin,
 people,
 shifts,
}:{
 workplaceId:string
 eventId:string
 isAdmin:boolean
 people:WorkplacePlannerPerson[]
 shifts:WorkplacePlannerShift[]
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
    <input name="role_name" defaultValue="Personeel" maxLength={200} className="rounded-lg border bg-background p-3"/>
    <select name="shift_kind" defaultValue="event" className="rounded-lg border bg-background p-3">
     <option value="event">Evenement</option>
     <option value="setup">Opbouw</option>
     <option value="breakdown">Afbouw</option>
    </select>
    <label className="flex items-center gap-2 rounded-lg border px-3">
     <input type="checkbox" name="overlap_allowed"/> Overlap toestaan
    </label>
    <DateInput name="start"/>
    <DateInput name="end"/>
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
      <span className="rounded-full border px-2 py-1 text-xs font-bold">{shift.responseStatus==='accepted'?'BEVESTIGD':shift.responseStatus==='declined'?'GEWEIGERD':'WACHT'}</span>
     </div>
    </div>

    {isAdmin&&shift.status!=='cancelled'&&<details className="mt-3 rounded-lg border p-3">
     <summary className="cursor-pointer text-sm font-semibold">Dienst bewerken</summary>
     <form action={updateShift} className="mt-3 grid gap-2 md:grid-cols-2">
      <input type="hidden" name="shift_id" value={shift.id}/>
      <input name="role_name" required maxLength={200} defaultValue={shift.roleName} className="rounded-lg border bg-background p-3"/>
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
