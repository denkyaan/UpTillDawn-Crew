export type PushLocale="nl"|"fr"|"en"|"de"
type Localized={fr:string;en:string;de:string}

const copy:Record<string,Localized>={
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
"Je hebt minstens 55 minuten pauze gebruikt. Alleen pauze boven 60 minuten wordt afgetrokken.":{fr:"Vous avez utilisé au moins 55 minutes de pause. Seul le temps au-delà de 60 minutes est déduit.",en:"You have used at least 55 minutes of break. Only break time beyond 60 minutes is deducted.",de:"Du hast mindestens 55 Minuten Pause genutzt. Nur Pausenzeit über 60 Minuten wird abgezogen."},
"Pauze langer dan 70 minuten":{fr:"Pause de plus de 70 minutes",en:"Break longer than 70 minutes",de:"Pause länger als 70 Minuten"},
"Check-in aangevraagd":{fr:"Check-in demandé",en:"Check-in requested",de:"Check-in angefordert"},
"Check-out aangevraagd":{fr:"Check-out demandé",en:"Check-out requested",de:"Check-out angefordert"},
"Admin-login tijdelijk geblokkeerd":{fr:"Connexion administrateur temporairement bloquée",en:"Admin login temporarily blocked",de:"Admin-Anmeldung vorübergehend gesperrt"},
"Dienst gestart":{fr:"Service commencé",en:"Shift started",de:"Schicht gestartet"},
"Je dienst is gestart en er is nog geen goedgekeurde start geregistreerd.":{fr:"Votre service a commencé et aucun début approuvé n’est encore enregistré.",en:"Your shift has started and no approved start has been recorded yet.",de:"Deine Schicht hat begonnen und es wurde noch kein genehmigter Start erfasst."},
"Personeelslid nog niet gestart":{fr:"Membre du personnel pas encore démarré",en:"Staff member has not started yet",de:"Mitarbeiter noch nicht gestartet"},
"Een geplande medewerker heeft 10 minuten na de starttijd nog geen goedgekeurde start.":{fr:"Un membre du personnel planifié n’a toujours pas de début approuvé 10 minutes après l’heure de début.",en:"A scheduled staff member still has no approved start 10 minutes after the start time.",de:"Ein eingeplanter Mitarbeiter hat 10 Minuten nach Schichtbeginn noch keinen genehmigten Start."},
"No-show gedetecteerd":{fr:"Absence détectée",en:"No-show detected",de:"Nichterscheinen erkannt"},
"Een geplande medewerker heeft 15 minuten na de starttijd nog geen goedgekeurde start.":{fr:"Un membre du personnel planifié n’a toujours pas de début approuvé 15 minutes après l’heure de début.",en:"A scheduled staff member still has no approved start 15 minutes after the start time.",de:"Ein eingeplanter Mitarbeiter hat 15 Minuten nach Schichtbeginn noch keinen genehmigten Start."},
"Werkplek onderbezet":{fr:"Poste en sous-effectif",en:"Workplace understaffed",de:"Arbeitsplatz unterbesetzt"},
"Shift voorbij":{fr:"Service terminé",en:"Shift end passed",de:"Schichtende überschritten"},
"Je geplande eindtijd is voorbij. Vraag je stopuren aan via de QR-flow.":{fr:"Votre heure de fin planifiée est dépassée. Demandez votre heure de fin via le flux QR.",en:"Your scheduled end time has passed. Request your stop time through the QR flow.",de:"Deine geplante Endzeit ist überschritten. Fordere deine Endzeit über den QR-Ablauf an."},
"Shift loopt door":{fr:"Le service se prolonge",en:"Shift is running over",de:"Schicht läuft über"},
"Een medewerker werkt meer dan 10 minuten na de geplande eindtijd zonder stopaanvraag.":{fr:"Un membre du personnel travaille plus de 10 minutes après l’heure de fin planifiée sans demande d’arrêt.",en:"A staff member is working more than 10 minutes past the scheduled end time without a stop request.",de:"Ein Mitarbeiter arbeitet mehr als 10 Minuten über das geplante Schichtende hinaus ohne Stoppanfrage."},
"Stopuren ontbreken":{fr:"Heure de fin manquante",en:"Stop time missing",de:"Endzeit fehlt"},
"Je shift is meer dan 20 minuten voorbij en er is nog geen stopaanvraag geregistreerd.":{fr:"Votre service est terminé depuis plus de 20 minutes et aucune demande d’arrêt n’est encore enregistrée.",en:"Your shift ended more than 20 minutes ago and no stop request has been recorded yet.",de:"Deine Schicht ist seit mehr als 20 Minuten beendet und es wurde noch keine Stoppanfrage erfasst."},
"Een medewerker werkt meer dan 20 minuten na de geplande eindtijd zonder stopaanvraag.":{fr:"Un membre du personnel travaille plus de 20 minutes après l’heure de fin planifiée sans demande d’arrêt.",en:"A staff member is working more than 20 minutes past the scheduled end time without a stop request.",de:"Ein Mitarbeiter arbeitet mehr als 20 Minuten über das geplante Schichtende hinaus ohne Stoppanfrage."},
"Een medewerker heeft tijdens dit evenement minstens 70 minuten pauze gebruikt en staat nog op pauze.":{fr:"Un membre du personnel a utilisé au moins 70 minutes de pause pendant cet événement et est toujours en pause.",en:"A staff member has used at least 70 minutes of break during this event and is still on break.",de:"Ein Mitarbeiter hat während dieses Events mindestens 70 Minuten Pause genutzt und befindet sich noch in Pause."},
"HELP ESCALATIE":{fr:"ESCALADE AIDE",en:"HELP ESCALATION",de:"HILFE-ESKALATION"},
"Een help-oproep is na 5 minuten nog niet erkend.":{fr:"Un appel d’aide n’a toujours pas été pris en charge après 5 minutes.",en:"A help request has still not been acknowledged after 5 minutes.",de:"Ein Hilferuf wurde nach 5 Minuten noch nicht bestätigt."},
"Verantwoordelijke ontbreekt":{fr:"Responsable manquant",en:"Responsible lead missing",de:"Verantwortliche Person fehlt"},
"Briefing nog niet bevestigd":{fr:"Briefing pas encore confirmé",en:"Briefing not yet confirmed",de:"Briefing noch nicht bestätigt"},
"Voorraad onder minimum":{fr:"Stock sous le minimum",en:"Stock below minimum",de:"Bestand unter Minimum"},
"Checklist nog niet afgerond":{fr:"Checklist pas encore terminée",en:"Checklist not yet completed",de:"Checkliste noch nicht abgeschlossen"},
"Dataconsistentie waarschuwing":{fr:"Avertissement de cohérence des données",en:"Data consistency warning",de:"Warnung zur Datenkonsistenz"},
"Operationele waarschuwing":{fr:"Alerte opérationnelle",en:"Operational warning",de:"Betriebliche Warnung"},
"Een actieve werkplek heeft geen toegewezen verantwoordelijke.":{fr:"Un poste actif n’a aucun responsable assigné.",en:"An active workplace has no assigned responsible lead.",de:"Ein aktiver Arbeitsplatz hat keine zugewiesene verantwortliche Person."},
"Een verplichte briefing is nog niet bevestigd voor een aankomende dienst.":{fr:"Un briefing obligatoire n’est pas encore confirmé pour un prochain service.",en:"A required briefing has not yet been confirmed for an upcoming shift.",de:"Ein verpflichtendes Briefing wurde für eine kommende Schicht noch nicht bestätigt."},
"De beschikbare voorraad heeft het ingestelde minimum bereikt.":{fr:"Le stock disponible a atteint le minimum configuré.",en:"Available stock has reached the configured minimum.",de:"Der verfügbare Bestand hat das eingestellte Minimum erreicht."},
"Een operationele checklist is na het geplande moment nog open.":{fr:"Une checklist opérationnelle est toujours ouverte après l’heure prévue.",en:"An operational checklist is still open after its scheduled time.",de:"Eine betriebliche Checkliste ist nach dem geplanten Zeitpunkt noch offen."},
"Er is een inconsistentie gevonden die nagekeken moet worden.":{fr:"Une incohérence a été détectée et doit être vérifiée.",en:"An inconsistency was found and needs to be reviewed.",de:"Es wurde eine Inkonsistenz gefunden, die überprüft werden muss."},
"Bekijk het command center voor details.":{fr:"Consultez le centre de commande pour plus de détails.",en:"Open the command center for details.",de:"Öffne das Command Center für Details."},
"Nieuw belangrijk document":{fr:"Nouveau document important",en:"New important document",de:"Neues wichtiges Dokument"},
"Nieuw evenementdocument":{fr:"Nouveau document d’événement",en:"New event document",de:"Neues Eventdokument"},
"Nieuwe accountgoedkeuring":{fr:"Nouvelle approbation de compte",en:"New account approval",de:"Neue Kontogenehmigung"},
"Account goedgekeurd":{fr:"Compte approuvé",en:"Account approved",de:"Konto genehmigt"},
"Je account is goedgekeurd. Je hebt nu toegang tot Up Till Dawn Crew.":{fr:"Votre compte est approuvé. Vous avez maintenant accès à Up Till Dawn Crew.",en:"Your account has been approved. You now have access to Up Till Dawn Crew.",de:"Dein Konto wurde genehmigt. Du hast jetzt Zugriff auf Up Till Dawn Crew."},
"Shift binnen 24 uur":{fr:"Service dans les 24 heures",en:"Shift within 24 hours",de:"Schicht innerhalb von 24 Stunden"},
"Shift binnen 2 uur":{fr:"Service dans les 2 heures",en:"Shift within 2 hours",de:"Schicht innerhalb von 2 Stunden"},
"Shift start binnenkort":{fr:"Le service commence bientôt",en:"Shift starts soon",de:"Schicht beginnt bald"},
"Materiaalretour gemeld":{fr:"Retour de matériel signalé",en:"Material return reported",de:"Materialrückgabe gemeldet"},
"Beschadigd materiaal gemeld":{fr:"Matériel endommagé signalé",en:"Damaged material reported",de:"Beschädigtes Material gemeldet"},
"Vermist materiaal gemeld":{fr:"Matériel manquant signalé",en:"Missing material reported",de:"Fehlendes Material gemeldet"},
"Materiaalmelding bevestigd":{fr:"Signalement de matériel confirmé",en:"Material report confirmed",de:"Materialmeldung bestätigt"},
"Materiaalmelding afgewezen":{fr:"Signalement de matériel refusé",en:"Material report rejected",de:"Materialmeldung abgelehnt"},
"Eventrapport klaar":{fr:"Rapport d’événement prêt",en:"Event report ready",de:"Eventbericht fertig"},
"Vertrek voor ophaling":{fr:"Départ pour la prise en charge",en:"Leave for pickup",de:"Abfahrt zur Abholung"},
"Vertrek voor afzetrit":{fr:"Départ pour le trajet de dépose",en:"Leave for drop-off",de:"Abfahrt zur Absetzfahrt"},
"Driver · artiest aangekomen":{fr:"Chauffeur · artiste arrivé",en:"Driver · artist arrived",de:"Fahrer · Künstler angekommen"},
"Backstage opvolging vereist":{fr:"Suivi backstage requis",en:"Backstage follow-up required",de:"Backstage-Nachverfolgung erforderlich"},
"Het is je verjaardag!🥳🎁":{fr:"C’est ton anniversaire ! 🥳🎁",en:"It’s your birthday! 🥳🎁",de:"Heute ist dein Geburtstag! 🥳🎁"},
"Van harte gefeliciteerd met je verjaardag!🥳 Laat het een fantastische dag zijn en maak er het beste van! 🎉🎉":{fr:"Joyeux anniversaire ! 🥳 Passe une journée fantastique et profite-en au maximum ! 🎉🎉",en:"Happy birthday! 🥳 Have a fantastic day and make the most of it! 🎉🎉",de:"Herzlichen Glückwunsch zum Geburtstag! 🥳 Hab einen fantastischen Tag und mach das Beste daraus! 🎉🎉"}
}

const localeOk=(locale:string):locale is keyof Localized=>locale==="fr"||locale==="en"||locale==="de"

function chatDynamic(value:string,locale:keyof Localized){
 const chatLabel=(label:string)=>{
  const rows:Record<string,Localized>={
   "Algemene chat":{fr:"Chat général",en:"General chat",de:"Allgemeiner Chat"},
   "Werkplekchat":{fr:"Chat du poste",en:"Workplace chat",de:"Arbeitsplatz-Chat"},
   "Eventchat":{fr:"Chat de l’événement",en:"Event chat",de:"Event-Chat"},
   "Privéchat":{fr:"Chat privé",en:"Private chat",de:"Privater Chat"},
  }
  return rows[label]?.[locale]||label
 }
 const mention=value.match(/^(.+) heeft je vermeld in (.+)$/)
 if(mention){const channel=chatLabel(mention[2]);return locale==="fr"?`${mention[1]} vous a mentionné dans ${channel}`:locale==="en"?`${mention[1]} mentioned you in ${channel}`:`${mention[1]} hat dich in ${channel} erwähnt`}
 const reply=value.match(/^(.+) heeft op je bericht geantwoord$/)
 if(reply)return locale==="fr"?`${reply[1]} a répondu à votre message`:locale==="en"?`${reply[1]} replied to your message`:`${reply[1]} hat auf deine Nachricht geantwortet`
 const privateMessage=value.match(/^Nieuw privébericht van (.+)$/)
 if(privateMessage)return locale==="fr"?`Nouveau message privé de ${privateMessage[1]}`:locale==="en"?`New private message from ${privateMessage[1]}`:`Neue private Nachricht von ${privateMessage[1]}`
 const groupMessage=value.match(/^Nieuw bericht in (.+)$/)
 if(groupMessage){const channel=chatLabel(groupMessage[1]);return locale==="fr"?`Nouveau message dans ${channel}`:locale==="en"?`New message in ${channel}`:`Neue Nachricht in ${channel}`}
 return null
}

function dynamic(value:string,locale:keyof Localized){
 const request=value.match(/^Aanvraag:\s*(pending|approved|rejected|cancelled|canceled)$/i)
 if(request){
  const map={fr:{pending:"en attente",approved:"approuvée",rejected:"refusée",cancelled:"annulée",canceled:"annulée"},en:{pending:"pending",approved:"approved",rejected:"rejected",cancelled:"cancelled",canceled:"cancelled"},de:{pending:"offen",approved:"genehmigt",rejected:"abgelehnt",cancelled:"storniert",canceled:"storniert"}} as const
  return `${locale==="fr"?"Demande":locale==="en"?"Request":"Anfrage"}: ${map[locale][request[1].toLowerCase() as keyof typeof map.fr]}`
 }
 const shift=value.match(/^(.+?) · (.+?) start binnen (24 uur|2 uur|15 minuten)(\. Gebruik de QR-flow bij aankomst\.)?$/)
 if(shift){
  const [,eventName,workplace,window,qr]=shift
  const span=window==="24 uur"?(locale==="fr"?"24 heures":locale==="en"?"24 hours":"24 Stunden"):window==="2 uur"?(locale==="fr"?"2 heures":locale==="en"?"2 hours":"2 Stunden"):(locale==="fr"?"15 minutes":locale==="en"?"15 minutes":"15 Minuten")
  const base=locale==="fr"?`${eventName} · ${workplace} commence dans ${span}.`:locale==="en"?`${eventName} · ${workplace} starts within ${span}.`:`${eventName} · ${workplace} beginnt in ${span}.`
  return qr?base+" "+(locale==="fr"?"Utilisez le flux QR à votre arrivée.":locale==="en"?"Use the QR flow when you arrive.":"Nutze bei deiner Ankunft den QR-Ablauf."):base
 }
 const staffing=value.match(/^Actieve bezetting op (.+): (\d+)\/(\d+)\.$/)
 if(staffing)return locale==="fr"?`Effectif actif à ${staffing[1]} : ${staffing[2]}/${staffing[3]}.`:locale==="en"?`Active staffing at ${staffing[1]}: ${staffing[2]}/${staffing[3]}.`:`Aktive Besetzung bei ${staffing[1]}: ${staffing[2]}/${staffing[3]}.`
 const approval=value.match(/^Nieuw account wacht op goedkeuring: (.+)\.$/)
 if(approval)return locale==="fr"?`Un nouveau compte attend une approbation : ${approval[1]}.`:locale==="en"?`A new account is awaiting approval: ${approval[1]}.`:`Ein neues Konto wartet auf Genehmigung: ${approval[1]}.`
 const report=value.match(/^(.+) is afgerond\. Het automatische eventrapport staat klaar\.$/)
 if(report)return locale==="fr"?`${report[1]} est terminé. Le rapport automatique de l’événement est prêt.`:locale==="en"?`${report[1]} is complete. The automatic event report is ready.`:`${report[1]} ist abgeschlossen. Der automatische Eventbericht ist fertig.`
 const inventory=value.match(/^(.+) · (\d+) stuk\(s\)( · .+)?$/)
 if(inventory)return `${inventory[1]} · ${inventory[2]} ${locale==="fr"?"pièce(s)":locale==="en"?"item(s)":"Stück"}${inventory[3]||""}`
 const driver=value.match(/^(.+) · (Ophalen|Afzetten): (.+?) · (.+?) · (.+?) · rit ±(\d+) min · 15 min vertrekmarge\.$/)
 if(driver){
  const action=driver[2]==="Ophalen"?(locale==="fr"?"Prise en charge":locale==="en"?"Pickup":"Abholung"):(locale==="fr"?"Dépose":locale==="en"?"Drop-off":"Absetzen")
  const suffix=locale==="fr"?`trajet ±${driver[6]} min · marge de départ 15 min.`:locale==="en"?`drive ±${driver[6]} min · 15 min departure margin.`:`Fahrt ±${driver[6]} Min. · 15 Min. Abfahrtsreserve.`
  return `${driver[1]} · ${action}: ${driver[3]} · ${driver[4]} · ${driver[5]} · ${suffix}`
 }
 const arrival=value.match(/^Driver is aangekomen op het evenement met artiest - (.+?)\.(?: (Stel een backstage werkplek in\.|Er is geen backstage manager toegewezen\.))?$/)
 if(arrival){
  const base=locale==="fr"?`Le chauffeur est arrivé à l’événement avec l’artiste - ${arrival[1]}.`:locale==="en"?`The driver arrived at the event with artist - ${arrival[1]}.`:`Der Fahrer ist mit dem Künstler - ${arrival[1]} - am Event angekommen.`
  if(!arrival[2])return base
  const extra=arrival[2].startsWith("Stel")?(locale==="fr"?"Configurez un poste backstage.":locale==="en"?"Configure a backstage workplace.":"Richte einen Backstage-Arbeitsplatz ein."):(locale==="fr"?"Aucun responsable backstage n’est assigné.":locale==="en"?"No backstage manager is assigned.":"Es ist kein Backstage-Manager zugewiesen.")
  return `${base} ${extra}`
 }
 const lockout=value.match(/^3 mislukte admin-loginpogingen\. Account: (.+?)\. IP: (.+?)\. Locatie \(benadering\): (.+?)\. Apparaat\/browser: (.+?)\. Login gedurende 15 minuten geblokkeerd\.$/)
 if(lockout){
  const localUnknown=(part:string)=>part==="onbekend"?(locale==="fr"?"inconnu":locale==="en"?"unknown":"unbekannt"):part
  const account=lockout[1],ip=localUnknown(lockout[2]),location=localUnknown(lockout[3]),device=localUnknown(lockout[4])
  return locale==="fr"?`3 tentatives de connexion administrateur ont échoué. Compte : ${account}. IP : ${ip}. Localisation (approximative) : ${location}. Appareil/navigateur : ${device}. Connexion bloquée pendant 15 minutes.`:locale==="en"?`3 admin login attempts failed. Account: ${account}. IP: ${ip}. Location (approximate): ${location}. Device/browser: ${device}. Login blocked for 15 minutes.`:`3 Admin-Anmeldeversuche sind fehlgeschlagen. Konto: ${account}. IP: ${ip}. Standort (ungefähr): ${location}. Gerät/Browser: ${device}. Anmeldung für 15 Minuten gesperrt.`
 }
 return null
}

function localizeDutchRequestStatus(value:string){
 const request=value.match(/^Aanvraag:\s*(pending|approved|rejected|cancelled|canceled)$/i)
 if(!request)return null
 const map={pending:"in afwachting",approved:"goedgekeurd",rejected:"afgewezen",cancelled:"geannuleerd",canceled:"geannuleerd"} as const
 return `Aanvraag: ${map[request[1].toLowerCase() as keyof typeof map]}`
}

export function localizePushText(value:unknown,locale:string){
 const text=String(value||"")
 if(locale==="nl")return localizeDutchRequestStatus(text)||text
 if(!localeOk(locale))return text
 return copy[text]?.[locale]||chatDynamic(text,locale)||dynamic(text,locale)||text
}
