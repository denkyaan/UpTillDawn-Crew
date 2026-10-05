export type PushLocale="nl"|"fr"|"en"|"de"
type PushTranslation={fr:string;en:string;de:string}

const copy:Record<string,PushTranslation>={
"Open incident op jouw werkplek":{fr:"Incident ouvert sur votre poste",en:"Open incident at your workplace",de:"Offener Vorfall an deinem Arbeitsplatz"},
"Taak vraagt opvolging":{fr:"Une tâche nécessite un suivi",en:"Task needs follow-up",de:"Aufgabe erfordert Nachverfolgung"},
"Een taak op jouw werkplek is te laat.":{fr:"Une tâche sur votre poste est en retard.",en:"A task at your workplace is overdue.",de:"Eine Aufgabe an deinem Arbeitsplatz ist überfällig."},
"Werkplekoverdracht wacht op jou":{fr:"Une transmission de poste vous attend",en:"Workplace handover is waiting for you",de:"Arbeitsplatzübergabe wartet auf dich"},
"Een klaargezette overdracht wacht nog op jouw acceptatie.":{fr:"Une transmission préparée attend encore votre acceptation.",en:"A prepared handover is still waiting for your acceptance.",de:"Eine vorbereitete Übergabe wartet noch auf deine Annahme."},
"Je hebt een open taak":{fr:"Vous avez une tâche ouverte",en:"You have an open task",de:"Du hast eine offene Aufgabe"},
"Bekijk je open taak.":{fr:"Consultez votre tâche ouverte.",en:"Review your open task.",de:"Prüfe deine offene Aufgabe."},
"Briefing nog bevestigen":{fr:"Briefing encore à confirmer",en:"Briefing still needs confirmation",de:"Briefing noch bestätigen"},
"Lees en bevestig je verplichte briefing vóór je shift.":{fr:"Lisez et confirmez votre briefing obligatoire avant votre service.",en:"Read and confirm your required briefing before your shift.",de:"Lies und bestätige dein verpflichtendes Briefing vor deiner Schicht."},
"Pauzetegoed bijna op":{fr:"Crédit de pause presque épuisé",en:"Break allowance almost used",de:"Pausenguthaben fast aufgebraucht"},
"Je hebt minstens 55 minuten pauze gebruikt. Alleen pauze boven 60 minuten wordt afgetrokken.":{fr:"Vous avez utilisé au moins 55 minutes de pause. Seule la pause au-delà de 60 minutes est déduite.",en:"You have used at least 55 minutes of break. Only break time beyond 60 minutes is deducted.",de:"Du hast mindestens 55 Minuten Pause genutzt. Nur Pausenzeit über 60 Minuten wird abgezogen."},
"Pauze langer dan 70 minuten":{fr:"Pause de plus de 70 minutes",en:"Break longer than 70 minutes",de:"Pause länger als 70 Minuten"},
"Check-in aangevraagd":{fr:"Check-in demandé",en:"Check-in requested",de:"Check-in angefordert"},
"Check-out aangevraagd":{fr:"Check-out demandé",en:"Check-out requested",de:"Check-out angefordert"},
"Admin-login tijdelijk geblokkeerd":{fr:"Connexion administrateur temporairement bloquée",en:"Admin login temporarily blocked",de:"Admin-Anmeldung vorübergehend gesperrt"},
"Nieuw belangrijk document":{fr:"Nouveau document important",en:"New important document",de:"Neues wichtiges Dokument"},
"Nieuw evenementdocument":{fr:"Nouveau document d’événement",en:"New event document",de:"Neues Veranstaltungsdokument"},
"Nieuwe accountgoedkeuring":{fr:"Nouvelle approbation de compte",en:"New account approval",de:"Neue Kontofreigabe"},
"Verantwoordelijke ontbreekt":{fr:"Responsable manquant",en:"Responsible lead missing",de:"Verantwortliche Person fehlt"},
"Briefing nog niet bevestigd":{fr:"Briefing pas encore confirmé",en:"Briefing not yet confirmed",de:"Briefing noch nicht bestätigt"},
"Voorraad onder minimum":{fr:"Stock sous le minimum",en:"Stock below minimum",de:"Bestand unter Minimum"},
"Checklist nog niet afgerond":{fr:"Checklist pas encore terminée",en:"Checklist not yet completed",de:"Checkliste noch nicht abgeschlossen"},
"Dataconsistentie waarschuwing":{fr:"Avertissement de cohérence des données",en:"Data consistency warning",de:"Warnung zur Datenkonsistenz"},
"Operationele waarschuwing":{fr:"Alerte opérationnelle",en:"Operational warning",de:"Betriebliche Warnung"},
"Een actieve werkplek heeft geen toegewezen verantwoordelijke.":{fr:"Un poste actif n’a aucun responsable attribué.",en:"An active workplace has no assigned responsible lead.",de:"Ein aktiver Arbeitsplatz hat keine zugewiesene verantwortliche Person."},
"Een verplichte briefing is nog niet bevestigd voor een aankomende dienst.":{fr:"Un briefing obligatoire n’est pas encore confirmé pour un service à venir.",en:"A required briefing has not yet been confirmed for an upcoming shift.",de:"Ein verpflichtendes Briefing wurde für eine bevorstehende Schicht noch nicht bestätigt."},
"De beschikbare voorraad heeft het ingestelde minimum bereikt.":{fr:"Le stock disponible a atteint le minimum défini.",en:"Available stock has reached the configured minimum.",de:"Der verfügbare Bestand hat das eingestellte Minimum erreicht."},
"Een operationele checklist is na het geplande moment nog open.":{fr:"Une checklist opérationnelle est encore ouverte après l’heure prévue.",en:"An operational checklist is still open after its scheduled time.",de:"Eine betriebliche Checkliste ist nach dem geplanten Zeitpunkt noch offen."},
"Er is een inconsistentie gevonden die nagekeken moet worden.":{fr:"Une incohérence a été détectée et doit être vérifiée.",en:"An inconsistency was found and needs to be reviewed.",de:"Eine Inkonsistenz wurde gefunden und muss geprüft werden."},
"Bekijk het command center voor details.":{fr:"Consultez le centre de commande pour plus de détails.",en:"View the command center for details.",de:"Details finden Sie im Command Center."},
"Vertrek voor ophaling":{fr:"Départ pour prise en charge",en:"Leave for pickup",de:"Abfahrt zur Abholung"},
"Vertrek voor afzetrit":{fr:"Départ pour dépose",en:"Leave for drop-off",de:"Abfahrt zur Absetzfahrt"}
}

function supportedLocale(locale:string):PushLocale{
 return locale==="fr"||locale==="en"||locale==="de"||locale==="nl"?locale:"nl"
}

function translateRequestDecision(text:string,locale:PushLocale){
 const match=text.match(/^Aanvraag:\s*(pending|approved|rejected|cancelled)$/i)
 if(!match)return null
 const state=match[1].toLowerCase() as "pending"|"approved"|"rejected"|"cancelled"
 const labels={
  nl:{pending:"in afwachting",approved:"goedgekeurd",rejected:"afgewezen",cancelled:"geannuleerd"},
  fr:{pending:"en attente",approved:"approuvée",rejected:"refusée",cancelled:"annulée"},
  en:{pending:"pending",approved:"approved",rejected:"rejected",cancelled:"cancelled"},
  de:{pending:"ausstehend",approved:"genehmigt",rejected:"abgelehnt",cancelled:"storniert"},
 } as const
 const prefix={nl:"Aanvraag",fr:"Demande",en:"Request",de:"Anfrage"} as const
 return `${prefix[locale]}: ${labels[locale][state]}`
}

function translateAccountApproval(text:string,locale:PushLocale){
 const match=text.match(/^Nieuw account wacht op goedkeuring: (.+)\.$/)
 if(!match)return null
 if(locale==="fr")return `Nouveau compte en attente d’approbation : ${match[1]}.`
 if(locale==="en")return `New account awaiting approval: ${match[1]}.`
 if(locale==="de")return `Neues Konto wartet auf Freigabe: ${match[1]}.`
 return text
}

function translateDriverDeparture(text:string,locale:PushLocale){
 const match=text.match(/^(.+?) · (Ophalen|Afzetten): (.*?) · (.*?) · (.*?) · rit ±(\d+) min · 15 min vertrekmarge\.$/)
 if(!match)return null
 const [,eventName,direction,passenger,phone,address,minutes]=match
 if(locale==="fr")return `${eventName} · ${direction==="Ophalen"?"Prise en charge":"Dépose"} : ${passenger} · ${phone} · ${address} · trajet ±${minutes} min · marge de départ 15 min.`
 if(locale==="en")return `${eventName} · ${direction==="Ophalen"?"Pickup":"Drop-off"}: ${passenger} · ${phone} · ${address} · trip ±${minutes} min · 15 min departure margin.`
 if(locale==="de")return `${eventName} · ${direction==="Ophalen"?"Abholen":"Absetzen"}: ${passenger} · ${phone} · ${address} · Fahrt ±${minutes} Min · 15 Min Abfahrtspuffer.`
 return text
}

function translateAdminLockout(text:string,locale:PushLocale){
 const match=text.match(/^3 mislukte admin-loginpogingen\. Account: (.*?)\. IP: (.*?)\. Locatie \(benadering\): (.*?)\. Apparaat\/browser: (.*?)\. Login gedurende 15 minuten geblokkeerd\.$/)
 if(!match)return null
 const unknown=(value:string)=>{
  if(value!=="onbekend")return value
  if(locale==="fr")return "inconnu"
  if(locale==="en")return "unknown"
  if(locale==="de")return "unbekannt"
  return value
 }
 const account=match[1],ip=unknown(match[2]),location=unknown(match[3]),agent=unknown(match[4])
 if(locale==="fr")return `3 tentatives de connexion administrateur échouées. Compte : ${account}. IP : ${ip}. Localisation (approximative) : ${location}. Appareil/navigateur : ${agent}. Connexion bloquée pendant 15 minutes.`
 if(locale==="en")return `3 failed admin login attempts. Account: ${account}. IP: ${ip}. Approximate location: ${location}. Device/browser: ${agent}. Login blocked for 15 minutes.`
 if(locale==="de")return `3 fehlgeschlagene Admin-Anmeldeversuche. Konto: ${account}. IP: ${ip}. Standort (ungefähr): ${location}. Gerät/Browser: ${agent}. Anmeldung für 15 Minuten gesperrt.`
 return text
}

export function localizePushText(value:unknown,locale:string){
 const text=String(value||"")
 const target=supportedLocale(locale)
 const dynamic=
  translateRequestDecision(text,target)||
  translateAccountApproval(text,target)||
  translateDriverDeparture(text,target)||
  translateAdminLockout(text,target)
 if(dynamic)return dynamic
 if(target==="nl")return text
 return copy[text]?.[target]||text
}
