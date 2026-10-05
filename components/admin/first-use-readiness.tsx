"use client"

import Link from "next/link"
import {useEffect,useState} from "react"
import {CalendarDays,CheckCircle2,ClipboardList,GraduationCap,Users,Warehouse} from "lucide-react"
import {
  LANGUAGE_APPLIED_EVENT,
  activeUiLocale,
  parseUiLocale,
  type SupportedUiLocale,
} from "@/lib/locale-preferences"

type Props={
  pendingApprovals:number
  approvedCrew:number
}

const COPY={
  nl:{
    eyebrow:"EERSTE GEBRUIK",
    heading:"Klaar voor je eerste echte evenement",
    intro:"Er staat nog geen productie-evenement in de app. Start hieronder; trainingsdata blijven volledig gescheiden van echte gegevens.",
    crew:(approved:number,pending:number)=>`${approved} goedgekeurde account(s) · ${pending} aanvraag/aanvragen open`,
    createTitle:"1. Maak het eerste evenement",
    createBody:"Naam, locatie, start/einde, aanmelddeadline, capaciteit en GPS-radius vormen de basis. De standaard werkplekken worden automatisch klaargezet.",
    createAction:"EERSTE EVENEMENT AANMAKEN",
    crewTitle:"2. Keur echte crewaccounts goed",
    crewBody:"Nieuwe registraties krijgen pas toegang na e-mailverificatie en admin-goedkeuring. Wijs meteen de juiste initiële rol toe.",
    crewAction:"GOEDKEURINGEN OPENEN",
    planningTitle:"3. Plan werkplekken, verantwoordelijken en shifts",
    planningBody:"Na het aanmaken staan Inkom & Guestlist, Merch, Bar/Toog, Tokens, Backstage Management, Driver, Allrounder, Opbouw en Afbouw klaar.",
    planningAction:"WERKPLEKKEN & SHIFTS",
    briefingTitle:"4. Maak briefing en operationele voorbereiding af",
    briefingBody:"Vul briefing, checklist, inventaris, prijslijsten, guestlist en overige eventinformatie in voordat de crew start.",
    briefingAction:"BRIEFING OPENEN",
    trainingTitle:"5. Controleer de workflow in Training",
    trainingBody:"De rondleiding gebruikt uitsluitend fictieve sandboxgegevens en wijzigt geen productie-event, uren of crewdata.",
    trainingAction:"TRAINING OPENEN",
    ready:"Productiestaat is schoon: geen echt evenement is nog aangemaakt. Je kunt veilig vanaf stap 1 beginnen.",
  },
  en:{
    eyebrow:"FIRST USE",
    heading:"Ready for your first real event",
    intro:"There is no production event in the app yet. Start below; training data stays fully separated from real data.",
    crew:(approved:number,pending:number)=>`${approved} approved account(s) · ${pending} request(s) pending`,
    createTitle:"1. Create the first event",
    createBody:"Name, location, start/end, registration deadline, capacity and GPS radius form the basis. Standard workplaces are prepared automatically.",
    createAction:"CREATE FIRST EVENT",
    crewTitle:"2. Approve real crew accounts",
    crewBody:"New registrations only get access after email verification and admin approval. Assign the correct initial role immediately.",
    crewAction:"OPEN APPROVALS",
    planningTitle:"3. Plan workplaces, responsible leads and shifts",
    planningBody:"After creation, Entrance & Guestlist, Merch, Bar/Counter, Tokens, Backstage Management, Driver, Allrounder, Setup and Breakdown are ready.",
    planningAction:"WORKPLACES & SHIFTS",
    briefingTitle:"4. Finish briefing and operational preparation",
    briefingBody:"Complete the briefing, checklist, inventory, price lists, guest list and other event information before crew starts.",
    briefingAction:"OPEN BRIEFING",
    trainingTitle:"5. Verify the workflow in Training",
    trainingBody:"The tour uses fictional sandbox data only and never changes production events, work hours or crew data.",
    trainingAction:"OPEN TRAINING",
    ready:"Production state is clean: no real event has been created yet. You can safely start at step 1.",
  },
  fr:{
    eyebrow:"PREMIÈRE UTILISATION",
    heading:"Prêt pour votre premier vrai événement",
    intro:"Aucun événement de production n’est encore présent dans l’application. Commencez ci-dessous ; les données de formation restent totalement séparées des données réelles.",
    crew:(approved:number,pending:number)=>`${approved} compte(s) approuvé(s) · ${pending} demande(s) en attente`,
    createTitle:"1. Créez le premier événement",
    createBody:"Nom, lieu, début/fin, délai d’inscription, capacité et rayon GPS constituent la base. Les postes standard sont préparés automatiquement.",
    createAction:"CRÉER LE PREMIER ÉVÉNEMENT",
    crewTitle:"2. Approuvez les vrais comptes de l’équipe",
    crewBody:"Les nouvelles inscriptions n’obtiennent l’accès qu’après vérification de l’e-mail et approbation admin. Attribuez immédiatement le bon rôle initial.",
    crewAction:"OUVRIR LES APPROBATIONS",
    planningTitle:"3. Planifiez postes, responsables et shifts",
    planningBody:"Après création, Entrée & Guestlist, Merch, Bar/Comptoir, Tokens, Backstage Management, Driver, Allrounder, Montage et Démontage sont prêts.",
    planningAction:"POSTES & SHIFTS",
    briefingTitle:"4. Finalisez briefing et préparation opérationnelle",
    briefingBody:"Complétez briefing, checklist, inventaire, listes de prix, guestlist et autres informations avant le début de l’équipe.",
    briefingAction:"OUVRIR LE BRIEFING",
    trainingTitle:"5. Vérifiez le workflow dans Training",
    trainingBody:"La visite utilise uniquement des données sandbox fictives et ne modifie jamais les événements, heures ou données d’équipe de production.",
    trainingAction:"OUVRIR TRAINING",
    ready:"L’état de production est propre : aucun vrai événement n’a encore été créé. Vous pouvez commencer en toute sécurité à l’étape 1.",
  },
  de:{
    eyebrow:"ERSTE NUTZUNG",
    heading:"Bereit für dein erstes echtes Event",
    intro:"In der App gibt es noch kein Produktions-Event. Starte unten; Trainingsdaten bleiben vollständig von echten Daten getrennt.",
    crew:(approved:number,pending:number)=>`${approved} genehmigte(s) Konto/Konten · ${pending} offene Anfrage(n)`,
    createTitle:"1. Erstelle das erste Event",
    createBody:"Name, Ort, Start/Ende, Anmeldefrist, Kapazität und GPS-Radius bilden die Basis. Standard-Arbeitsplätze werden automatisch vorbereitet.",
    createAction:"ERSTES EVENT ERSTELLEN",
    crewTitle:"2. Genehmige echte Crew-Konten",
    crewBody:"Neue Registrierungen erhalten erst nach E-Mail-Verifizierung und Admin-Genehmigung Zugriff. Weise sofort die richtige Anfangsrolle zu.",
    crewAction:"GENEHMIGUNGEN ÖFFNEN",
    planningTitle:"3. Plane Arbeitsplätze, Verantwortliche und Schichten",
    planningBody:"Nach dem Erstellen sind Eingang & Gästeliste, Merch, Bar/Theke, Tokens, Backstage Management, Driver, Allrounder, Aufbau und Abbau bereit.",
    planningAction:"ARBEITSPLÄTZE & SCHICHTEN",
    briefingTitle:"4. Briefing und operative Vorbereitung abschließen",
    briefingBody:"Fülle Briefing, Checkliste, Inventar, Preislisten, Gästeliste und weitere Eventinformationen aus, bevor die Crew startet.",
    briefingAction:"BRIEFING ÖFFNEN",
    trainingTitle:"5. Prüfe den Ablauf im Training",
    trainingBody:"Die Führung nutzt ausschließlich fiktive Sandboxdaten und verändert keine Produktions-Events, Arbeitszeiten oder Crewdaten.",
    trainingAction:"TRAINING ÖFFNEN",
    ready:"Der Produktionsstand ist sauber: Es wurde noch kein echtes Event erstellt. Du kannst sicher bei Schritt 1 beginnen.",
  },
} as const

const STEPS=[
  {icon:CalendarDays,headingKey:"createTitle",bodyKey:"createBody",actionKey:"createAction",href:"/events#event-aanmaken"},
  {icon:Users,headingKey:"crewTitle",bodyKey:"crewBody",actionKey:"crewAction",href:"/personnel"},
  {icon:Warehouse,headingKey:"planningTitle",bodyKey:"planningBody",actionKey:"planningAction",href:"/workplaces"},
  {icon:ClipboardList,headingKey:"briefingTitle",bodyKey:"briefingBody",actionKey:"briefingAction",href:"/briefings"},
  {icon:GraduationCap,headingKey:"trainingTitle",bodyKey:"trainingBody",actionKey:"trainingAction",href:"/help"},
] as const

export function FirstUseReadiness({pendingApprovals,approvedCrew}:Props){
  const [locale,setLocale]=useState<SupportedUiLocale>("nl")

  useEffect(()=>{
    const apply=()=>{
      const next=parseUiLocale(activeUiLocale())
      if(next)setLocale(next)
    }
    apply()
    window.addEventListener(LANGUAGE_APPLIED_EVENT,apply)
    return()=>window.removeEventListener(LANGUAGE_APPLIED_EVENT,apply)
  },[])

  const t=COPY[locale]
  return <section data-no-translate className="space-y-4 rounded-3xl border border-violet-500/40 bg-violet-500/5 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-black uppercase tracking-[.2em] text-violet-400">{t.eyebrow}</p>
        <h2 className="mt-1 text-2xl font-black">{t.heading}</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{t.intro}</p>
      </div>
      <span className="rounded-full border px-3 py-2 text-xs font-black">{t.crew(approvedCrew,pendingApprovals)}</span>
    </div>

    <p className="flex items-start gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"/>
      <span>{t.ready}</span>
    </p>

    <div className="grid gap-3 lg:grid-cols-2">
      {STEPS.map(({icon:Icon,headingKey,bodyKey,actionKey,href},index)=><article key={href} className={`rounded-2xl border p-4 ${index===0?"border-violet-500/50":""}`}>
        <div className="flex gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted"><Icon className="h-4 w-4"/></span>
          <div>
            <h3 className="font-black">{t[headingKey]}</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{t[bodyKey]}</p>
          </div>
        </div>
        <Link href={href} className={`mt-4 inline-flex rounded-xl px-4 py-2 text-sm font-black ${index===0?"bg-violet-600 text-white":"border"}`}>{t[actionKey]}</Link>
      </article>)}
    </div>
  </section>
}
