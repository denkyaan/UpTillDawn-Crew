import { updateEventEmergencyInformation } from '@/lib/actions/uptilldawn'
import { emergencyInformationIsUsable } from '@/lib/emergency-mode'

export type EmergencyInfoView={
  eventId:string
  eventName:string
  eventAddress:string
  emergencyNumber:string
  firstAidContact:string|null
  securityContact:string|null
  assemblyPoint:string|null
  procedure:string|null
  updatedAt:string|null
}

function telHref(value:string){
  const cleaned=value.replace(/[^+\\d]/g,'')
  return cleaned?'tel:'+cleaned:undefined
}

export function EmergencyInformationPanel({
  info,
  canEdit=false,
  compact=false,
}:{
  info:EmergencyInfoView
  canEdit?:boolean
  compact?:boolean
}){
  const usable=emergencyInformationIsUsable({
    eventName:info.eventName,
    eventAddress:info.eventAddress,
    emergencyNumber:info.emergencyNumber,
    firstAidContact:info.firstAidContact,
    securityContact:info.securityContact,
    assemblyPoint:info.assemblyPoint,
    procedure:info.procedure,
    updatedAt:info.updatedAt?Date.parse(info.updatedAt):0,
  })
  const tel=telHref(info.emergencyNumber)
  const sectionClass='space-y-3 rounded-2xl border '+(usable?'border-red-500/40 bg-red-500/5':'border-amber-500/40 bg-amber-500/5')+' '+(compact?'p-3':'p-4')
  const badgeClass='rounded-full border px-2 py-1 text-xs font-black '+(usable?'border-red-500/50 text-red-600':'border-amber-500/50 text-amber-600')

  return <section className={sectionClass}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className={compact?'font-black':'text-xl font-black'}>Noodinformatie</h2>
        <p className="text-sm text-muted-foreground">{info.eventName}</p>
      </div>
      <span className={badgeClass}>{usable?'NOODINFO BESCHIKBAAR':'ONVOLLEDIG'}</span>
    </div>

    {usable
      ? <div className="grid gap-2 md:grid-cols-2">
          <div className="rounded-xl border p-3">
            <p className="text-xs font-bold uppercase text-muted-foreground">Noodnummer</p>
            {tel
              ? <a href={tel} className="mt-1 inline-block text-2xl font-black text-red-600 underline">{info.emergencyNumber}</a>
              : <p className="mt-1 text-2xl font-black text-red-600">{info.emergencyNumber}</p>}
          </div>
          <div className="rounded-xl border p-3">
            <p className="text-xs font-bold uppercase text-muted-foreground">Adres</p>
            <p className="mt-1 font-semibold">{info.eventAddress}</p>
          </div>
          {info.firstAidContact&&<div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase text-muted-foreground">EHBO</p><p className="mt-1 whitespace-pre-wrap">{info.firstAidContact}</p></div>}
          {info.securityContact&&<div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Security</p><p className="mt-1 whitespace-pre-wrap">{info.securityContact}</p></div>}
          {info.assemblyPoint&&<div className="rounded-xl border p-3 md:col-span-2"><p className="text-xs font-bold uppercase text-muted-foreground">Verzamelpunt</p><p className="mt-1 whitespace-pre-wrap font-semibold">{info.assemblyPoint}</p></div>}
          {info.procedure&&<div className="rounded-xl border p-3 md:col-span-2"><p className="text-xs font-bold uppercase text-muted-foreground">Noodprocedure</p><p className="mt-1 whitespace-pre-wrap">{info.procedure}</p></div>}
        </div>
      : <p className="text-sm font-semibold">Admin moet minstens een geldig noodnummer invullen en het evenement moet een adres hebben voordat deze noodinfo als compleet wordt beschouwd.</p>}

    {info.updatedAt&&<p className="text-xs text-muted-foreground">Laatst bijgewerkt: {new Date(info.updatedAt).toLocaleString('nl-BE')}</p>}

    {canEdit&&<details className="rounded-xl border bg-background p-3">
      <summary className="cursor-pointer font-semibold">Noodinformatie bewerken</summary>
      <form action={updateEventEmergencyInformation} className="mt-3 grid gap-2">
        <input type="hidden" name="event_id" value={info.eventId}/>
        <label className="grid gap-1 text-sm">Noodnummer
          <input name="emergency_number" required maxLength={40} defaultValue={info.emergencyNumber||'112'} className="rounded-lg border bg-background p-3"/>
        </label>
        <label className="grid gap-1 text-sm">EHBO-contact
          <textarea name="first_aid_contact" maxLength={300} defaultValue={info.firstAidContact||''} placeholder="Naam, telefoon, locatie…" className="rounded-lg border bg-background p-3"/>
        </label>
        <label className="grid gap-1 text-sm">Security-contact
          <textarea name="security_contact" maxLength={300} defaultValue={info.securityContact||''} placeholder="Naam, telefoon, post…" className="rounded-lg border bg-background p-3"/>
        </label>
        <label className="grid gap-1 text-sm">Verzamelpunt
          <textarea name="assembly_point" maxLength={500} defaultValue={info.assemblyPoint||''} placeholder="Exacte locatie voor evacuatie/verzameling" className="rounded-lg border bg-background p-3"/>
        </label>
        <label className="grid gap-1 text-sm">Noodprocedure
          <textarea name="procedure" maxLength={5000} defaultValue={info.procedure||''} placeholder="Wat moet personeel doen bij evacuatie, brand, medisch incident…" className="min-h-28 rounded-lg border bg-background p-3"/>
        </label>
        <button className="rounded-lg bg-violet-600 p-3 font-bold text-white">NOODINFORMATIE OPSLAAN</button>
      </form>
    </details>}
  </section>
}
