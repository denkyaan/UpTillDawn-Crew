// Deterministic next-best-action selection. Never writes times, approvals or attendance.
export type DashboardShift={
  id:string
  event_id:string
  workplace_id:string
  scheduled_start:string
  scheduled_end:string
}
export type DashboardActionKind='active'|'prepare'|'scheduled'|'assigned'|'discover'
export type DashboardAction={kind:DashboardActionKind;href:string;shiftStart?:string}

export function dashboardNextAction(shifts:readonly DashboardShift[],nowMs:number,hasEventAssignment:boolean):DashboardAction {
  if(!Number.isFinite(nowMs))return {kind:'discover',href:'/events'}
  const valid=shifts.map(shift=>({
    shift,start:Date.parse(shift.scheduled_start),end:Date.parse(shift.scheduled_end),
  })).filter(row=>Number.isFinite(row.start)&&Number.isFinite(row.end)&&row.start<=row.end&&row.end>=nowMs)
  const active=valid.filter(row=>row.start<=nowMs).sort((a,b)=>a.end-b.end)[0]
  if(active)return {kind:'active',href:'/operations?event='+encodeURIComponent(active.shift.event_id)+'&workplace='+encodeURIComponent(active.shift.workplace_id),shiftStart:active.shift.scheduled_start}
  const next=valid.filter(row=>row.start>nowMs).sort((a,b)=>a.start-b.start)[0]
  if(next)return next.start-nowMs<=48*60*60*1000
    ?{kind:'prepare',href:'/briefings?event='+encodeURIComponent(next.shift.event_id),shiftStart:next.shift.scheduled_start}
    :{kind:'scheduled',href:'/workplaces?event='+encodeURIComponent(next.shift.event_id),shiftStart:next.shift.scheduled_start}
  return hasEventAssignment?{kind:'assigned',href:'/events'}:{kind:'discover',href:'/events'}
}

export const dashboardActionCopy={
  nl:{
    heading:'Volgende actie',
    active:{title:'Je shift is bezig',description:'Open werkuren voor check-in, pauze of uitchecken. De app registreert niets zonder jouw actie.',button:'Mijn werkuren'},
    prepare:{title:'Bereid je shift voor',description:'Je volgende shift start binnen 48 uur. Lees de briefing en controleer je instructies.',button:'Briefing bekijken'},
    scheduled:{title:'Je volgende shift',description:'Bekijk je planning en toegewezen werkplek.',button:'Planning bekijken'},
    assigned:{title:'Je evenement',description:'Controleer de beschikbaarheid, planning en eventinformatie.',button:'Evenement bekijken'},
    discover:{title:'Bekijk beschikbare evenementen',description:'Er is geen aankomende shift toegewezen.',button:'Evenementen bekijken'},
  },
  fr:{
    heading:'Prochaine action',
    active:{title:'Votre shift est en cours',description:'Ouvrez vos heures pour le pointage, la pause ou la fin. Rien n’est enregistré sans votre action.',button:'Mes heures'},
    prepare:{title:'Préparez votre shift',description:'Votre prochain shift commence dans les 48 heures. Consultez le briefing et vos instructions.',button:'Voir le briefing'},
    scheduled:{title:'Votre prochain shift',description:'Consultez votre planning et le poste attribué.',button:'Voir le planning'},
    assigned:{title:'Votre événement',description:'Consultez vos disponibilités, le planning et les informations.',button:'Voir l’événement'},
    discover:{title:'Événements disponibles',description:'Aucun shift à venir ne vous est attribué.',button:'Voir les événements'},
  },
  en:{
    heading:'Next action',
    active:{title:'Your shift is underway',description:'Open work hours for check-in, breaks or check-out. Nothing is recorded without your action.',button:'My work hours'},
    prepare:{title:'Prepare for your shift',description:'Your next shift starts within 48 hours. Read your briefing and instructions.',button:'View briefing'},
    scheduled:{title:'Your next shift',description:'Review your schedule and assigned workplace.',button:'View schedule'},
    assigned:{title:'Your event',description:'Review availability, your schedule and event information.',button:'View event'},
    discover:{title:'Available events',description:'You have no upcoming assigned shift.',button:'View events'},
  },
  de:{
    heading:'Nächste Aktion',
    active:{title:'Deine Schicht läuft',description:'Öffne die Zeiterfassung zum Einchecken, für Pausen oder zum Auschecken. Nichts wird ohne deine Aktion erfasst.',button:'Meine Arbeitszeiten'},
    prepare:{title:'Bereite deine Schicht vor',description:'Deine nächste Schicht beginnt innerhalb von 48 Stunden. Lies Briefing und Anweisungen.',button:'Briefing ansehen'},
    scheduled:{title:'Deine nächste Schicht',description:'Prüfe Dienstplan und zugewiesenen Arbeitsplatz.',button:'Dienstplan ansehen'},
    assigned:{title:'Dein Event',description:'Prüfe Verfügbarkeit, Dienstplan und Eventinformationen.',button:'Event ansehen'},
    discover:{title:'Verfügbare Events',description:'Dir ist keine bevorstehende Schicht zugewiesen.',button:'Events ansehen'},
  },
} as const
