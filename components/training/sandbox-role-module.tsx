"use client"
import {useEffect,useState} from "react"
import {activeUiLocale,LANGUAGE_APPLIED_EVENT,type SupportedUiLocale} from "@/lib/locale-preferences"

const KEY="uptilldawn-training-workflow-v3"
const t=(l:SupportedUiLocale,nl:string,en:string,fr:string,de:string)=>({nl,en,fr,de}[l])
export type TrainingRole="admin"|"responsible_lead"|"employee"|"staff"
type Module="chat"|"crew"|"personnel"|"exports"|"platform"|"settings"

const NEXT:Record<string,Partial<Record<Module,string|null>>>={
 employee:{crew:"chat",chat:"settings",settings:"timesheet"},
 staff:{crew:"chat",chat:"settings",settings:"timesheet"},
 responsible_lead:{crew:"chat",chat:"settings",settings:"timesheet"},
 admin:{personnel:"crew",crew:"chat",chat:"exports",exports:"platform",platform:"settings",settings:"timesheet"},
}

function persist(next:string|null,module:Module){
 let s:Record<string,unknown>={}
 try{s=JSON.parse(sessionStorage.getItem(KEY)||"{}")}catch{}
 // Settings is not proof that the user completed the operational workflow.
 const trainingComplete=false
 sessionStorage.setItem(KEY,JSON.stringify({...s,[module+"TrainingDone"]:true,navTarget:next,trainingComplete}))
 if(module!=="chat")dispatchEvent(new CustomEvent("uptilldawn-training-nav-target",{detail:{target:next||undefined}}))
 if(module==="chat"){sessionStorage.setItem("chatTourCompleted","1");const updated={...s,chatTourCompleted:true,[module+"TrainingDone"]:true,navTarget:"__chat_button",chatNextTarget:next,trainingComplete};sessionStorage.setItem(KEY,JSON.stringify(updated));dispatchEvent(new CustomEvent("uptilldawn-training-chat-completed"));dispatchEvent(new CustomEvent("uptilldawn-training-nav-target",{detail:{target:"__chat_button"}}));window.setTimeout(()=>{sessionStorage.setItem(KEY,JSON.stringify({...updated,navTarget:next}));dispatchEvent(new CustomEvent("uptilldawn-training-nav-target",{detail:{target:next||undefined}}))},2200)}
 // Completion is emitted only after the user submits the sandbox timesheet.
}

export function SandboxRoleModule({role,module}:{role:TrainingRole;module:Module}){
 const [l,setL]=useState<SupportedUiLocale>("nl")
 const [done,setDone]=useState(false)
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
 const actions=actionSets[module]
 const [actionIndex,setActionIndex]=useState(0)
 const [hydrated,setHydrated]=useState(false)
 // Each sandbox action is recorded independently, per role and module.
 // Resuming the tour must not silently complete unperformed actions.
 const actionKey="uptilldawn-demo-actions-v1:"+role+":"+module
 useEffect(()=>{
  const frame=requestAnimationFrame(()=>{
  try{
   const stored=JSON.parse(sessionStorage.getItem(actionKey)||"[]") as unknown
   const recorded=Array.isArray(stored)?stored.filter((n):n is number=>Number.isInteger(n)&&n>=0&&n<actions.length):[]
   const uniqueSteps=new Set(recorded)
   let firstMissing=0
   while(firstMissing<actions.length&&uniqueSteps.has(firstMissing))firstMissing++
   setActionIndex(Math.min(firstMissing,actions.length-1))
   setDone(firstMissing===actions.length)
  }catch{setActionIndex(0);setDone(false)}
  setHydrated(true)
  });return()=>cancelAnimationFrame(frame)
 // The action inventory is fixed per module; translations do not change indices.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[actionKey])
 const complete=()=>{
  if(!hydrated||done)return
  let recorded:number[]=[]
  try{const saved=JSON.parse(sessionStorage.getItem(actionKey)||"[]");if(Array.isArray(saved))recorded=saved.filter((n):n is number=>Number.isInteger(n))}catch{}
  // Only the currently displayed action can be credited.
  const nextRecorded=[...new Set([...recorded,actionIndex])]
  sessionStorage.setItem(actionKey,JSON.stringify(nextRecorded))
  if(actionIndex<actions.length-1){setActionIndex(value=>value+1);return}
  if(actions.some((_,index)=>!nextRecorded.includes(index)))return
  setDone(true);persist(next,module)
 }
 return <main className="mx-auto max-w-5xl space-y-5 p-4 pb-28 md:p-8">
  <header><p className="text-xs font-black uppercase tracking-[.2em] text-violet-400">{t(l,"TRAINING · FICTIEVE GEGEVENS","TRAINING · FICTIONAL DATA","FORMATION · DONNÉES FICTIVES","TRAINING · FIKTIVE DATEN")}</p><h1 className="text-3xl font-black">{copy.title}</h1><p className="mt-1 text-sm text-muted-foreground">{copy.desc}</p></header>
  <section className="rounded-2xl border p-4"><h2 className="font-black">{t(l,"UpTillDawn Trainingsavond","UpTillDawn Training Night","Soirée d’entraînement UpTillDawn","UpTillDawn Trainingsabend")}</h2><p className="mt-2 text-sm">{copy.desc}</p><p className="mt-3 text-xs font-bold text-muted-foreground">{Math.min(actionIndex+1,actions.length)}/{actions.length}</p><button data-tour-demo="primary-action" onClick={complete} disabled={done||!hydrated} className="mt-2 rounded-xl border p-3 font-black disabled:opacity-60">{done?t(l,"VOLTOOID","COMPLETED","TERMINÉ","ERLEDIGT"):actions[actionIndex]}</button>{done&&<div className="mt-3 rounded-xl border p-3 text-sm"><p className="font-semibold">{copy.result}</p>{next&&<p className="mt-2">{t(l,"De volgende trainingsfunctie wordt nu geopend.","The next training feature now opens.","La fonction de formation suivante s’ouvre maintenant.","Die nächste Trainingsfunktion wird jetzt geöffnet.")}</p>}</div>}</section>
 </main>
}
