"use client"
import {useEffect,useState} from "react"
import {TrainingQuestionsPanel} from "@/components/training/training-questions-panel"
import {getParticipantTrainingScenarioId} from "@/lib/training/scenario-sync"
import {activeUiLocale,LANGUAGE_APPLIED_EVENT,type SupportedUiLocale} from "@/lib/locale-preferences"

const KEY="uptilldawn-training-workflow-v3"
const t=(l:SupportedUiLocale,nl:string,en:string,fr:string,de:string)=>({nl,en,fr,de}[l])
export type TrainingRole="admin"|"responsible_lead"|"employee"|"staff"
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
 const trainingComplete=module==="settings"
 sessionStorage.setItem(KEY,JSON.stringify({...s,[module+"TrainingDone"]:true,navTarget:next,trainingComplete}))
 dispatchEvent(new CustomEvent("uptilldawn-training-nav-target",{detail:{target:next||undefined}}))
 if(module==="chat"){sessionStorage.setItem("chatTourCompleted","1");const updated={...s,chatTourCompleted:true,[module+"TrainingDone"]:true,navTarget:"__chat_button",chatNextTarget:next,trainingComplete};sessionStorage.setItem(KEY,JSON.stringify(updated));dispatchEvent(new CustomEvent("uptilldawn-training-chat-completed"));dispatchEvent(new CustomEvent("uptilldawn-training-nav-target",{detail:{target:"__chat_button"}}));window.setTimeout(()=>{sessionStorage.setItem(KEY,JSON.stringify({...updated,navTarget:next}));dispatchEvent(new CustomEvent("uptilldawn-training-nav-target",{detail:{target:next||undefined}}))},2200)}
 if(trainingComplete)dispatchEvent(new CustomEvent("uptilldawn-training-completed"))
}

export function SandboxRoleModule({role,module}:{role:TrainingRole;module:Module}){
 const [l,setL]=useState<SupportedUiLocale>("nl")
 const [done,setDone]=useState(false)
 const [questionScenario,setQuestionScenario]=useState("")
 const [questionError,setQuestionError]=useState("")
 useEffect(()=>{const f=()=>setL(activeUiLocale());f();addEventListener(LANGUAGE_APPLIED_EVENT,f);return()=>removeEventListener(LANGUAGE_APPLIED_EVENT,f)},[])
 const next=NEXT[role]?.[module]??null
 const copy={
  chat:{title:t(l,"Chats","Chats","Chats","Chats"),desc:t(l,"Organisatie-, event- en werkplekcommunicatie.","Organisation, event and workplace communication.","Communication organisation, événement et poste.","Organisations-, Event- und Arbeitsplatzkommunikation."),action:t(l,"BERICHT VERSTUREN","SEND MESSAGE","ENVOYER LE MESSAGE","NACHRICHT SENDEN"),result:t(l,"Trainingsbericht verzonden in de fictieve eventchat.","Training message sent in the fictional event chat.","Message d’entraînement envoyé dans le chat fictif de l’événement.","Trainingsnachricht im fiktiven Event-Chat gesendet.")},
  crew:{title:t(l,"Personeel","Staff","Personnel","Personal"),desc:role==="admin"?t(l,"Beheer rollen, blokkeringen en bestaande personeelsaccounts.","Manage roles, blocks and existing staff accounts.","Gérez les rôles, blocages et comptes du personnel existant.","Verwalte Rollen, Sperren und bestehende Personalkonten."):t(l,"Bekijk de operationele personeelslijst en contactgegevens.","View the operational staff directory and contact details.","Consultez la liste opérationnelle du personnel et les coordonnées.","Sieh die operative Personalliste und Kontaktdaten."),action:role==="admin"?t(l,"DEMO-PROFIEL OPENEN","OPEN DEMO PROFILE","OUVRIR LE PROFIL DÉMO","DEMO-PROFIL ÖFFNEN"):t(l,"CONTACT OPENEN","OPEN CONTACT","OUVRIR LE CONTACT","KONTAKT ÖFFNEN"),result:t(l,"Fictief personeelsprofiel geopend; er zijn geen productiegegevens gewijzigd.","Fictional staff profile opened; no production data was changed.","Profil fictif ouvert ; aucune donnée de production n’a été modifiée.","Fiktives Personalprofil geöffnet; keine Produktionsdaten wurden geändert.")},
  personnel:{title:t(l,"Goedkeuringen","Approvals","Approbations","Genehmigungen"),desc:t(l,"Behandel nieuwe accountaanvragen en wijs de initiële rol toe.","Process new account requests and assign the initial role.","Traitez les nouvelles demandes de compte et attribuez le rôle initial.","Bearbeite neue Kontoanträge und weise die anfängliche Rolle zu."),action:t(l,"DEMO-ACCOUNT GOEDKEUREN","APPROVE DEMO ACCOUNT","APPROUVER LE COMPTE DÉMO","DEMO-KONTO GENEHMIGEN"),result:t(l,"Demo-account goedgekeurd als Personeel.","Demo account approved as Staff.","Compte démo approuvé comme Personnel.","Demo-Konto als Personal genehmigt.")},
  exports:{title:"Excel",desc:t(l,"Exporteer goedgekeurde en gelockte werkuren voor administratie.","Export approved and locked work hours for administration.","Exportez les heures approuvées et verrouillées pour l’administration.","Exportiere genehmigte und gesperrte Arbeitszeiten für die Verwaltung."),action:t(l,"DEMO-EXPORT VOORBEREIDEN","PREPARE DEMO EXPORT","PRÉPARER L’EXPORT DÉMO","DEMO-EXPORT VORBEREITEN"),result:t(l,"Fictieve XLSX-export voorbereid zonder productiegegevens.","Fictional XLSX export prepared without production data.","Export XLSX fictif préparé sans données de production.","Fiktiver XLSX-Export ohne Produktionsdaten vorbereitet.")},
  platform:{title:t(l,"Platformbeheer","Platform management","Gestion de la plateforme","Plattformverwaltung"),desc:t(l,"Automatiseringen, templates, rollouts, QR, recovery en technische configuratie.","Automations, templates, rollouts, QR, recovery and technical configuration.","Automatisations, modèles, déploiements, QR, recovery et configuration technique.","Automatisierungen, Vorlagen, Rollouts, QR, Recovery und technische Konfiguration."),action:t(l,"DEMO-AUTOMATISERING OPENEN","OPEN DEMO AUTOMATION","OUVRIR L’AUTOMATISATION DÉMO","DEMO-AUTOMATISIERUNG ÖFFNEN"),result:t(l,"Fictieve automatisering gecontroleerd; niets werd gepubliceerd.","Fictional automation reviewed; nothing was published.","Automatisation fictive vérifiée ; rien n’a été publié.","Fiktive Automatisierung geprüft; nichts wurde veröffentlicht.")},
  settings:{title:role==="admin"?t(l,"Beheer","Management","Gestion","Verwaltung"):t(l,"Profiel","Profile","Profil","Profil"),desc:t(l,"Controleer profiel, taal en de instellingen die bij je rol horen.","Review profile, language and the settings available to your role.","Vérifiez le profil, la langue et les paramètres disponibles pour votre rôle.","Prüfe Profil, Sprache und die für deine Rolle verfügbaren Einstellungen."),action:t(l,"TRAINING AFRONDEN","FINISH TRAINING","TERMINER LA FORMATION","TRAINING ABSCHLIESSEN"),result:t(l,"De volledige roltraining is afgerond.","The complete role training is finished.","La formation complète du rôle est terminée.","Das vollständige Rollentraining ist abgeschlossen.")},
 }[module]
 const actionSets:Record<Module,string[]>={
  personnel:role==="admin"?[
   t(l,"Aanvraag openen","Open request","Ouvrir la demande","Anfrage öffnen"),
   t(l,"Profiel controleren","Review profile","Vérifier le profil","Profil prüfen"),
   t(l,"Initiële rol kiezen","Choose initial role","Choisir le rôle initial","Anfangsrolle wählen"),
   t(l,"Account goedkeuren","Approve account","Approuver le compte","Konto genehmigen"),
  ]:[copy.action],
  crew:role==="admin"?[
   t(l,"Personeelsprofiel openen","Open staff profile","Ouvrir le profil du personnel","Personalprofil öffnen"),
   t(l,"Rol wijzigen","Change role","Modifier le rôle","Rolle ändern"),
   t(l,"Account blokkeren en deblokkeren","Block and unblock account","Bloquer et débloquer le compte","Konto sperren und entsperren"),
   t(l,"Personeel verwijderen controleren","Review staff deletion","Contrôler la suppression du personnel","Personal-Löschung prüfen"),
  ]:[
   t(l,"Personeelslijst openen","Open staff directory","Ouvrir la liste du personnel","Personalliste öffnen"),
   t(l,"Contactgegevens openen","Open contact details","Ouvrir les coordonnées","Kontaktdaten öffnen"),
  ],
  chat:[
   t(l,"Eventchat openen","Open event chat","Ouvrir le chat événement","Event-Chat öffnen"),
   t(l,"Privéchat starten","Start private chat","Démarrer un chat privé","Privatchat starten"),
   t(l,"Antwoord en @-vermelding gebruiken","Use reply and @mention","Utiliser réponse et @mention","Antwort und @-Erwähnung nutzen"),
   t(l,"Trainingsbericht versturen","Send training message","Envoyer le message de formation","Trainingsnachricht senden"),
  ],
  exports:[
   t(l,"Goedgekeurde uren selecteren","Select approved hours","Sélectionner les heures approuvées","Genehmigte Stunden auswählen"),
   t(l,"Gelockte uren controleren","Review locked hours","Vérifier les heures verrouillées","Gesperrte Stunden prüfen"),
   t(l,"Excel-export voorbereiden","Prepare Excel export","Préparer l’export Excel","Excel-Export vorbereiten"),
  ],
  platform:[
   t(l,"Automatiseringen openen","Open automations","Ouvrir les automatisations","Automatisierungen öffnen"),
   t(l,"Templates controleren","Review templates","Vérifier les modèles","Vorlagen prüfen"),
   t(l,"Rollouts controleren","Review rollouts","Vérifier les déploiements","Rollouts prüfen"),
   t(l,"QR-configuratie openen","Open QR configuration","Ouvrir la configuration QR","QR-Konfiguration öffnen"),
   t(l,"Recovery controleren","Review recovery","Vérifier le recovery","Recovery prüfen"),
   t(l,"Technische configuratie openen","Open technical configuration","Ouvrir la configuration technique","Technische Konfiguration öffnen"),
  ],
  settings:[
   t(l,"Profielinstellingen openen","Open profile settings","Ouvrir les paramètres du profil","Profileinstellungen öffnen"),
   t(l,"Taalinstelling controleren","Review language setting","Vérifier la langue","Spracheinstellung prüfen"),
   t(l,"Rolinstellingen controleren","Review role settings","Vérifier les paramètres du rôle","Rolleneinstellungen prüfen"),
   t(l,"Training afronden","Finish training","Terminer la formation","Training abschließen"),
  ],
 }
 const exerciseContext:Partial<Record<Module,string[]>>={
  personnel:[
   t(l,"Nieuwe aanvraag: Alex Vermeer · alex.training@example.invalid · status: wacht op goedkeuring. Controleer eerst de aanvraag.","New request: Alex Vermeer · alex.training@example.invalid · status: pending. Inspect the request first.","Nouvelle demande : Alex Vermeer · alex.training@example.invalid · statut : en attente. Examinez la demande.","Neue Anfrage: Alex Vermeer · alex.training@example.invalid · Status: ausstehend. Prüfe zuerst die Anfrage."),
   t(l,"Controleer het fictieve profiel en de contactgegevens; ga na of de registratie compleet is.","Check the fictional profile and contact details; confirm registration is complete.","Vérifiez le profil fictif et les coordonnées ; assurez-vous que l’inscription est complète.","Prüfe das fiktive Profil und die Kontaktdaten auf Vollständigkeit."),
   t(l,"Ken voor deze oefening de rol Personeel toe. Verantwoordelijke en Admin geven meer bevoegdheden.","Assign the Staff role for this exercise. Responsible and Admin grant more permissions.","Attribuez le rôle Personnel pour cet exercice. Responsable et Admin accordent davantage de droits.","Weise für diese Übung die Rolle Personal zu. Verantwortliche und Admin haben mehr Rechte."),
   t(l,"Bevestig de demo-goedkeuring. In de echte app krijgt de gebruiker daarna toegang volgens de toegewezen rol.","Confirm demo approval. In the real app, the user then receives access according to the assigned role.","Confirmez l’approbation démo. Dans l’application réelle, l’utilisateur accède selon son rôle.","Bestätige die Demo-Genehmigung. In der echten App erhält die Person Zugriff gemäß ihrer Rolle."),
  ],
  crew:[
   t(l,"Open het fictieve profiel van Alex Vermeer en controleer de gekoppelde werkplekken.","Open Alex Vermeer's fictional profile and inspect assigned workplaces.","Ouvrez le profil fictif d’Alex Vermeer et vérifiez les postes attribués.","Öffne Alex Vermeers fiktives Profil und prüfe die zugewiesenen Arbeitsplätze."),
   t(l,"Simuleer een rolwijziging van Personeel naar Verantwoordelijke; controleer welke bevoegdheden veranderen.","Simulate changing Staff to Responsible; review the resulting permissions.","Simulez le passage de Personnel à Responsable ; vérifiez les autorisations.","Simuliere den Wechsel von Personal zu Verantwortliche und prüfe die Berechtigungen."),
   t(l,"Simuleer blokkeren en daarna deblokkeren. Een geblokkeerd account mag niet inloggen.","Simulate blocking and unblocking. A blocked account must not sign in.","Simulez le blocage puis le déblocage. Un compte bloqué ne peut pas se connecter.","Simuliere Sperren und Entsperren. Ein gesperrtes Konto darf sich nicht anmelden."),
   t(l,"Controleer de verwijderbevestiging. Deze oefening verwijdert nooit een echt account.","Review the deletion confirmation. This exercise never deletes a real account.","Vérifiez la confirmation de suppression. Cet exercice ne supprime jamais de compte réel.","Prüfe die Löschbestätigung. Diese Übung löscht niemals ein echtes Konto."),
  ],
  chat:[
   t(l,"Open de fictieve evenementchat en controleer de deelnemers en het evenement.","Open the fictional event chat and check its participants and event.","Ouvrez le chat fictif de l’événement et vérifiez les participants.","Öffne den fiktiven Event-Chat und prüfe Teilnehmer und Event."),
   t(l,"Start een fictief privégesprek met een crewlid. Berichten blijven in deze trainingsomgeving.","Start a fictional private conversation with a crew member. Messages stay in training.","Démarrez une conversation privée fictive avec un membre de l’équipe.","Starte ein fiktives Privatgespräch mit einem Crewmitglied."),
   t(l,"Oefen antwoorden op een bericht en een @-vermelding om iemand gericht aan te spreken.","Practice replying to a message and using an @mention to address someone.","Entraînez-vous à répondre à un message et à utiliser une @mention.","Übe eine Antwort auf eine Nachricht und eine @-Erwähnung."),
   t(l,"Verstuur het fictieve trainingsbericht. Er wordt geen echt chatbericht verstuurd.","Send the fictional training message. No real chat message is sent.","Envoyez le message fictif. Aucun vrai message n’est envoyé.","Sende die fiktive Trainingsnachricht. Es wird keine echte Nachricht versendet."),
  ],
  exports:[
   t(l,"Selecteer alleen goedgekeurde uren van het fictieve evenement; afgekeurde uren horen niet in de export.","Select only approved hours from the fictional event; rejected hours must be excluded.","Sélectionnez uniquement les heures approuvées ; excluez les heures rejetées.","Wähle nur genehmigte Stunden des fiktiven Events; abgelehnte Stunden bleiben außen vor."),
   t(l,"Controleer dat de uren vergrendeld zijn en dat pauzes niet als betaalde uren meetellen.","Verify hours are locked and breaks are excluded from paid hours.","Vérifiez que les heures sont verrouillées et que les pauses sont exclues.","Prüfe gesperrte Stunden und dass Pausen nicht als Arbeitszeit zählen."),
   t(l,"Bereid de fictieve Excel-export voor en controleer het totaal per medewerker.","Prepare the fictional Excel export and verify totals per crew member.","Préparez l’export Excel fictif et vérifiez les totaux par personne.","Bereite den fiktiven Excel-Export vor und prüfe die Summen je Person."),
  ],
  platform:[
   t(l,"Bekijk een fictieve automatische melding en controleer trigger, ontvanger en resultaat.","Inspect a fictional automation and check trigger, recipient and outcome.","Examinez une automatisation fictive : déclencheur, destinataire et résultat.","Prüfe eine fiktive Automation: Auslöser, Empfänger und Ergebnis."),
   t(l,"Controleer een berichttemplate in de vier talen en de gebruikte variabelen.","Review a message template in four languages and its variables.","Vérifiez un modèle de message dans les quatre langues et ses variables.","Prüfe eine Nachrichtenvorlage in vier Sprachen und ihre Variablen."),
   t(l,"Controleer de status van een fictieve rollout voordat je iets publiceert.","Check the status of a fictional rollout before publishing anything.","Vérifiez le statut d’un déploiement fictif avant publication.","Prüfe den Status eines fiktiven Rollouts vor einer Veröffentlichung."),
   t(l,"Bekijk de QR-instellingen en verifieer welke registratie- of eventlink gebruikt wordt.","Review QR settings and verify the registration or event link.","Vérifiez les paramètres QR et le lien d’inscription ou d’événement.","Prüfe QR-Einstellungen und den Registrierungs- oder Eventlink."),
   t(l,"Controleer het herstelplan, de foutregistratie en hoe een incident wordt geëscaleerd.","Review recovery plan, error reporting and incident escalation.","Vérifiez le plan de reprise, les erreurs et l’escalade des incidents.","Prüfe Wiederherstellungsplan, Fehlerberichte und Eskalation."),
   t(l,"Controleer de technische instellingen zonder productieconfiguratie te wijzigen.","Review technical settings without changing production configuration.","Vérifiez la configuration technique sans modifier la production.","Prüfe technische Einstellungen ohne Produktionskonfiguration zu ändern."),
  ],
  settings:[
   t(l,"Open het fictieve profiel en controleer naam en contactgegevens.","Open the fictional profile and check name and contact details.","Ouvrez le profil fictif et vérifiez le nom et les coordonnées.","Öffne das fiktive Profil und prüfe Namen und Kontaktdaten."),
   t(l,"Controleer of de gekozen taal overeenkomt met de getoonde interface.","Check that the selected language matches the displayed interface.","Vérifiez que la langue choisie correspond à l’interface.","Prüfe, ob die ausgewählte Sprache zur Oberfläche passt."),
   t(l,"Controleer welke instellingen voor jouw rol toegankelijk zijn.","Review which settings are available to your role.","Vérifiez les paramètres accessibles à votre rôle.","Prüfe die für deine Rolle verfügbaren Einstellungen."),
   t(l,"Rond de training af nadat alle oefenstappen zijn uitgevoerd.","Finish training after completing all practice steps.","Terminez la formation après toutes les étapes.","Schließe das Training nach allen Übungen ab."),
  ],
 }
 const actions=actionSets[module]
 const [actionIndex,setActionIndex]=useState(0)
 const complete=()=>{
  if(actionIndex<actions.length-1){setActionIndex(value=>value+1);return}
  setDone(true);persist(next,module)
 }
 return <main className="mx-auto max-w-5xl space-y-5 p-4 pb-28 md:p-8">
  <header><p className="text-xs font-black uppercase tracking-[.2em] text-violet-400">{t(l,"TRAINING · FICTIEVE GEGEVENS","TRAINING · FICTIONAL DATA","FORMATION · DONNÉES FICTIVES","TRAINING · FIKTIVE DATEN")}</p><h1 className="text-3xl font-black">{copy.title}</h1><p className="mt-1 text-sm text-muted-foreground">{copy.desc}</p></header>
  <section className="rounded-2xl border p-4"><h2 className="font-black">{t(l,"UpTillDawn Trainingsavond","UpTillDawn Training Night","Soirée d’entraînement UpTillDawn","UpTillDawn Trainingsabend")}</h2><p className="mt-2 text-sm">{copy.desc}</p><p className="mt-3 text-xs font-bold text-muted-foreground">{Math.min(actionIndex+1,actions.length)}/{actions.length}</p><p role="status" className="mt-2 rounded-xl border border-violet-500/40 bg-violet-500/5 p-3 text-sm leading-6">{exerciseContext[module]?.[actionIndex]||copy.desc}</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true"><div className="h-full bg-violet-500 transition-all" style={{width:`${(done?actions.length:actionIndex)/actions.length*100}%`}}/></div><button data-tour-demo="primary-action" onClick={complete} disabled={done} className="mt-2 rounded-xl border p-3 font-black disabled:opacity-60">{done?t(l,"VOLTOOID","COMPLETED","TERMINÉ","ERLEDIGT"):actions[actionIndex]}</button>{done&&<div className="mt-3 rounded-xl border p-3 text-sm"><p className="font-semibold">{copy.result}</p>{next&&<p className="mt-2">{t(l,"De volgende trainingsfunctie wordt nu geopend.","The next training feature now opens.","La fonction de formation suivante s’ouvre maintenant.","Die nächste Trainingsfunktion wird jetzt geöffnet.")}</p>}</div>}</section>
  {module==="settings"&&<section className="space-y-3 rounded-xl border p-4"><button type="button" className="rounded-xl border px-4 py-2" onClick={async()=>{try{setQuestionScenario(await getParticipantTrainingScenarioId());setQuestionError("")}catch{setQuestionError(t(l,"Geen gekoppeld trainingsscenario gevonden.","No linked training scenario found.","Aucun scénario de formation lié.","Kein verknüpftes Trainingsszenario gefunden."))}}}>{t(l,"Vragen over de opleiding","Training questions","Questions sur la formation","Fragen zur Schulung")}</button>{questionError&&<p role="alert">{questionError}</p>}{questionScenario&&<TrainingQuestionsPanel scenarioId={questionScenario} role={role==="staff"?"employee":role}/>}</section>}
 </main>
}
