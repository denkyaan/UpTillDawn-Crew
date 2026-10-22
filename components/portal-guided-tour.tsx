'use client'

import {useEffect,useState} from 'react'

type Locale='nl'|'fr'|'en'|'de'
type Portal='promotion'|'administration'
const translations={
 nl:{start:'Start rondleiding',restart:'Rondleiding opnieuw starten',next:'Volgende stap',previous:'Vorige',finish:'Afronden',close:'Sluiten',intro:'Voer elke stap zelf uit. Deze rondleiding wijzigt geen echte gegevens.',action:'Open de aangeduide functie om deze zelf te oefenen.',done:'Rondleiding afgerond. Je kan ze op elk moment herstarten.'},
 fr:{start:'Démarrer la visite',restart:'Recommencer la visite',next:'Étape suivante',previous:'Précédent',finish:'Terminer',close:'Fermer',intro:'Effectuez chaque étape vous-même. Cette visite ne modifie aucune donnée.',action:'Ouvrez la fonction indiquée pour vous entraîner.',done:'Visite terminée. Vous pouvez la recommencer à tout moment.'},
 en:{start:'Start tour',restart:'Restart tour',next:'Next step',previous:'Previous',finish:'Finish',close:'Close',intro:'Perform each step yourself. This tour does not change real data.',action:'Open the highlighted feature to practice.',done:'Tour completed. You can restart it any time.'},
 de:{start:'Rundgang starten',restart:'Rundgang neu starten',next:'Nächster Schritt',previous:'Zurück',finish:'Beenden',close:'Schließen',intro:'Führe jeden Schritt selbst aus. Diese Tour ändert keine echten Daten.',action:'Öffne die markierte Funktion zum Üben.',done:'Rundgang abgeschlossen. Du kannst ihn jederzeit neu starten.'},
} as const
const titles={
 promotion:{nl:['Overzicht','Promotiechats','Promotietaken','Meldingen'],fr:['Aperçu','Discussions promotion','Tâches promotion','Notifications'],en:['Overview','Promotion chats','Promotion tasks','Notifications'],de:['Übersicht','Promotion-Chats','Promotion-Aufgaben','Benachrichtigungen']},
 administration:{nl:['Overzicht','Financiële documenten','Ingediende werkstaten','Inventarisafwijkingen'],fr:['Aperçu','Documents financiers','Feuilles de temps','Écarts de stock'],en:['Overview','Financial documents','Submitted timesheets','Inventory discrepancies'],de:['Übersicht','Finanzdokumente','Eingereichte Stundenzettel','Bestandsabweichungen']},
} as const
const PROMOTION_TARGETS=['portal-overview','portal-chats','portal-tasks','portal-notifications'] as const
const ADMINISTRATION_TARGETS=['portal-overview','portal-finance','portal-timesheets','portal-inventory'] as const

export function PortalGuidedTour({portal,locale}:{portal:Portal;locale:Locale}){
 const [active,setActive]=useState(false)
 const [step,setStep]=useState(0)
 const [completed,setCompleted]=useState(false)
 const t=translations[locale]
 const labels=titles[portal][locale]
 const targets=portal==='promotion'?PROMOTION_TARGETS:ADMINISTRATION_TARGETS
 useEffect(()=>{
  if(!active)return
  const element=document.querySelector('[data-portal-tour="'+targets[step]+'"]')
  element?.scrollIntoView({block:'nearest',behavior:'smooth'})
 },[active,step,targets])
 const begin=()=>{setStep(0);setCompleted(false);setActive(true)}
 return <div data-no-translate className="space-y-3">
  {!active?<button type="button" onClick={begin} className="rounded-lg border border-violet-500 px-4 py-2 font-semibold text-violet-400">{completed?t.restart:t.start}</button>:
   <section role="region" aria-label={t.start} className="sticky top-3 z-30 rounded-xl border border-violet-500 bg-background p-4 shadow-lg">
    <p className="text-xs text-muted-foreground">{step+1} / {labels.length}</p>
    <h2 className="mt-1 font-semibold">{labels[step]}</h2>
    <p className="mt-2 text-sm">{step===0?t.intro:t.action}</p>
    <div className="mt-3 flex flex-wrap gap-2">
     <button type="button" onClick={()=>setStep(s=>Math.max(0,s-1))} disabled={step===0} className="rounded-lg border px-3 py-2 disabled:opacity-40">{t.previous}</button>
     <button type="button" onClick={()=>{
      if(step===labels.length-1){setActive(false);setCompleted(true)}else setStep(s=>s+1)
     }} className="rounded-lg bg-violet-600 px-3 py-2 text-white">{step===labels.length-1?t.finish:t.next}</button>
     <button type="button" onClick={()=>setActive(false)} className="rounded-lg border px-3 py-2">{t.close}</button>
    </div>
   </section>}
  {active&&<style>{'[data-portal-tour="'+targets[step]+'"]{outline:3px solid #a855f7;outline-offset:4px;border-radius:12px}'}</style>}
  {completed&&<p role="status" className="text-sm text-muted-foreground">{t.done}</p>}
 </div>
}
