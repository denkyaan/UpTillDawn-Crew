"use client"
import {useEffect,useState} from "react"
import {activeUiLocale,LANGUAGE_APPLIED_EVENT,type SupportedUiLocale} from "@/lib/locale-preferences"

const KEY="uptilldawn-training-workflow-v3"
const t=(l:SupportedUiLocale,nl:string,en:string,fr:string,de:string)=>({nl,en,fr,de}[l])
type Role="admin"|"responsible_lead"|"employee"|"staff"
type Module="chat"|"crew"|"personnel"|"exports"|"platform"|"settings"

const NEXT:Record<string,Partial<Record<Module,string|null>>>={
 employee:{chat:"crew",crew:"settings",settings:null},
 staff:{chat:"crew",crew:"settings",settings:null},
 responsible_lead:{chat:"crew",crew:"settings",settings:null},
 admin:{personnel:"crew",crew:"chat",chat:"exports",exports:"platform",platform:"settings",settings:null},
}

function persist(next:string|null,module:Module){
 let s:Record<string,unknown>={}
 try{s=JSON.parse(sessionStorage.getItem(KEY)||"{}")}catch{}
 sessionStorage.setItem(KEY,JSON.stringify({...s,[module+"TrainingDone"]:true,navTarget:next,trainingComplete:module==="settings"}))
 dispatchEvent(new CustomEvent("uptilldawn-training-nav-target",{detail:{target:next||undefined}}))
 if(module==="chat"){sessionStorage.setItem("chatTourCompleted","1");dispatchEvent(new CustomEvent("uptilldawn-training-chat-completed"))}
}

export function SandboxRoleModule({role,module}:{role:Role;module:Module}){
 const [l,setL]=useState<SupportedUiLocale>(()=>typeof window==="undefined"?"nl":activeUiLocale())
 const [done,setDone]=useState(false)
 useEffect(()=>{const f=()=>setL(activeUiLocale());addEventListener(LANGUAGE_APPLIED_EVENT,f);return()=>removeEventListener(LANGUAGE_APPLIED_EVENT,f)},[])
 const next=NEXT[role]?.[module]??null
 const copy={
  chat:{title:t(l,"Chats","Chats","Chats","Chats"),desc:t(l,"Organisatie-, event- en werkplekcommunicatie.","Organisation, event and workplace communication.","Communication organisation, événement et poste.","Organisations-, Event- und Arbeitsplatzkommunikation."),action:t(l,"BERICHT VERSTUREN","SEND MESSAGE","ENVOYER LE MESSAGE","NACHRICHT SENDEN"),result:t(l,"Trainingsbericht verzonden in de fictieve eventchat.","Training message sent in the fictional event chat.","Message d’entraînement envoyé dans le chat fictif de l’événement.","Trainingsnachricht im fiktiven Event-Chat gesendet.")},
  crew:{title:t(l,"Personeel","Staff","Personnel","Personal"),desc:role==="admin"?t(l,"Beheer rollen, blokkeringen en bestaande personeelsaccounts.","Manage roles, blocks and existing staff accounts.","Gérez les rôles, blocages et comptes du personnel existant.","Verwalte Rollen, Sperren und bestehende Personalkonten."):t(l,"Bekijk de operationele personeelslijst en contactgegevens.","View the operational staff directory and contact details.","Consultez la liste opérationnelle du personnel et les coordonnées.","Sieh die operative Personalliste und Kontaktdaten."),action:role==="admin"?t(l,"DEMO-PROFIEL OPENEN","OPEN DEMO PROFILE","OUVRIR LE PROFIL DÉMO","DEMO-PROFIL ÖFFNEN"):t(l,"CONTACT OPENEN","OPEN CONTACT","OUVRIR LE CONTACT","KONTAKT ÖFFNEN"),result:t(l,"Fictief personeelsprofiel geopend; er zijn geen productiegegevens gewijzigd.","Fictional staff profile opened; no production data was changed.","Profil fictif ouvert ; aucune donnée de production n’a été modifiée.","Fiktives Personalprofil geöffnet; keine Produktionsdaten wurden geändert.")},
  personnel:{title:t(l,"Goedkeuringen","Approvals","Approbations","Genehmigungen"),desc:t(l,"Behandel nieuwe accountaanvragen en wijs de initiële rol toe.","Process new account requests and assign the initial role.","Traitez les nouvelles demandes de compte et attribuez le rôle initial.","Bearbeite neue Kontoanträge und weise die anfängliche Rolle zu."),action:t(l,"DEMO-ACCOUNT GOEDKEUREN","APPROVE DEMO ACCOUNT","APPROUVER LE COMPTE DÉMO","DEMO-KONTO GENEHMIGEN"),result:t(l,"Demo-account goedgekeurd als Personeel.","Demo account approved as Staff.","Compte démo approuvé comme Personnel.","Demo-Konto als Personal genehmigt.")},
  exports:{title:"Excel",desc:t(l,"Exporteer goedgekeurde en gelockte werkuren voor administratie.","Export approved and locked work hours for administration.","Exportez les heures approuvées et verrouillées pour l’administration.","Exportiere genehmigte und gesperrte Arbeitszeiten für die Verwaltung."),action:t(l,"DEMO-EXPORT VOORBEREIDEN","PREPARE DEMO EXPORT","PRÉPARER L’EXPORT DÉMO","DEMO-EXPORT VORBEREITEN"),result:t(l,"Fictieve XLSX-export voorbereid zonder productiegegevens.","Fictional XLSX export prepared without production data.","Export XLSX fictif préparé sans données de production.","Fiktiver XLSX-Export ohne Produktionsdaten vorbereitet.")},
  platform:{title:t(l,"Platformbeheer","Platform management","Gestion de la plateforme","Plattformverwaltung"),desc:t(l,"Automatiseringen, templates, rollouts, QR, recovery en technische configuratie.","Automations, templates, rollouts, QR, recovery and technical configuration.","Automatisations, modèles, déploiements, QR, recovery et configuration technique.","Automatisierungen, Vorlagen, Rollouts, QR, Recovery und technische Konfiguration."),action:t(l,"DEMO-AUTOMATISERING OPENEN","OPEN DEMO AUTOMATION","OUVRIR L’AUTOMATISATION DÉMO","DEMO-AUTOMATISIERUNG ÖFFNEN"),result:t(l,"Fictieve automatisering gecontroleerd; niets werd gepubliceerd.","Fictional automation reviewed; nothing was published.","Automatisation fictive vérifiée ; rien n’a été publié.","Fiktive Automatisierung geprüft; nichts wurde veröffentlicht.")},
  settings:{title:role==="admin"?t(l,"Beheer","Management","Gestion","Verwaltung"):t(l,"Profiel","Profile","Profil","Profil"),desc:t(l,"Controleer profiel, taal en de instellingen die bij je rol horen.","Review profile, language and the settings available to your role.","Vérifiez le profil, la langue et les paramètres disponibles pour votre rôle.","Prüfe Profil, Sprache und die für deine Rolle verfügbaren Einstellungen."),action:t(l,"TRAINING AFRONDEN","FINISH TRAINING","TERMINER LA FORMATION","TRAINING ABSCHLIESSEN"),result:t(l,"De volledige roltraining is afgerond.","The complete role training is finished.","La formation complète du rôle est terminée.","Das vollständige Rollentraining ist abgeschlossen.")},
 }[module]
 const complete=()=>{setDone(true);persist(next,module)}
 return <main className="mx-auto max-w-5xl space-y-5 p-4 pb-28 md:p-8">
  <header><p className="text-xs font-black uppercase tracking-[.2em] text-violet-400">{t(l,"TRAINING · FICTIEVE GEGEVENS","TRAINING · FICTIONAL DATA","FORMATION · DONNÉES FICTIVES","TRAINING · FIKTIVE DATEN")}</p><h1 className="text-3xl font-black">{copy.title}</h1><p className="mt-1 text-sm text-muted-foreground">{copy.desc}</p></header>
  <section className="rounded-2xl border p-4"><h2 className="font-black">{t(l,"UpTillDawn Trainingsavond","UpTillDawn Training Night","Soirée d’entraînement UpTillDawn","UpTillDawn Trainingsabend")}</h2><p className="mt-2 text-sm">{copy.desc}</p><button data-tour-demo="primary-action" onClick={complete} disabled={done} className="mt-4 rounded-xl border p-3 font-black ring-4 ring-violet-500/40 disabled:opacity-60">{done?t(l,"VOLTOOID","COMPLETED","TERMINÉ","ERLEDIGT"):copy.action}</button>{done&&<div className="mt-3 rounded-xl border p-3 text-sm"><p className="font-semibold">{copy.result}</p>{next&&<p className="mt-2">{t(l,"Gebruik nu het gemarkeerde pijltje onderaan en open de volgende aangeduide functie.","Use the highlighted arrow below and open the next indicated feature.","Utilisez maintenant la flèche surlignée en bas et ouvrez la fonction suivante indiquée.","Nutze jetzt den markierten Pfeil unten und öffne die nächste markierte Funktion.")}</p>}</div>}</section>
 </main>
}
