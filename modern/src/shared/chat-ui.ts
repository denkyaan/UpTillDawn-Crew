import type {ChatRow} from "../lib/queries"
import type {Locale} from "./i18n"

// The standard room identifiers are stored in Dutch. Translate labels only;
// NEVER alter the canonical database names or trust client-side filtering for ACL.
const rooms={
 "Algemene chat promotie":{nl:"Algemene chat promotie",fr:"Discussion générale promotion",en:"General promotion chat",de:"Allgemeiner Promotion-Chat"},
 "Algemene chat evenementen":{nl:"Algemene chat evenementen",fr:"Discussion générale événements",en:"General events chat",de:"Allgemeiner Event-Chat"},
 "Admin · Administratie":{nl:"Admin · Administratie",fr:"Admin · Administration",en:"Admin · Administration",de:"Admin · Verwaltung"},
} as const
export function channelTitle(name:string,locale:Locale):string{
 return Object.prototype.hasOwnProperty.call(rooms,name)?
  rooms[name as keyof typeof rooms][locale]:name
}
export type ChatScope="events"|"promotion"
export function visibleChatChannels<T extends Pick<ChatRow,"name"|"kind">>(
 rows:readonly T[],scope:ChatScope
):T[]{
 // Server PostgREST RLS remains the authority for all rows, messages, reads
 // and writes. UI scoping prevents a promotion-only screen from advertising
 // unrelated permitted admin/crew chats.
 return scope==="promotion"
  ?rows.filter(x=>x.kind==="organization"&&x.name==="Algemene chat promotie")
  :[...rows]
}
const copy={
 nl:{channels:"Kanalen",loading:"Berichten laden…",historyError:"Chatgeschiedenis niet beschikbaar. Berichten zijn niet verwijderd.",empty:"Nog geen berichten.",you:"Jij",system:"Systeem",moderated:"Bericht gemodereerd",newMessage:"Nieuw bericht",placeholder:"Schrijf een bericht…",send:"Versturen",sent:"Verzonden",queued:"Lokaal bewaard. Verstuur opnieuw zodra je verbinding hebt.",queueFailed:"Bericht niet opgeslagen. Er is niets verzonden.",allSent:"Alle wachtende berichten verzonden",partial:"Sommige berichten staan nog in de wachtrij",stillQueued:"Berichten wachten nog op verzending.",accountFailed:"Accountcontrole mislukt. Niets verzonden.",retry:"Opnieuw verzenden",discard:"Verwijderen",thisChannel:"Dit kanaal",anotherChannel:"Ander kanaal",localQueue:"lokaal in wachtrij",readOnly:"Verzenden en leesbevestigingen blijven uitgeschakeld totdat de migratie is goedgekeurd.",parity:"Automatische chatvertaling, foto's en moderatie hebben nog niet volledige functiepariteit.",readers:"Gelezen door",readersFailed:"Leesbevestigingen zijn niet beschikbaar.",noReaders:"Nog geen leesbevestigingen.",close:"Sluiten"},
 fr:{channels:"Canaux",loading:"Chargement des messages…",historyError:"Historique indisponible. Aucun message n'a été supprimé.",empty:"Aucun message.",you:"Vous",system:"Système",moderated:"Message modéré",newMessage:"Nouveau message",placeholder:"Écrivez un message…",send:"Envoyer",sent:"Envoyé",queued:"Enregistré sur cet appareil. Réessayez en ligne.",queueFailed:"Impossible de sauvegarder. Rien n'a été envoyé.",allSent:"Tous les messages en attente ont été envoyés",partial:"Certains messages restent en attente",stillQueued:"Messages toujours en attente.",accountFailed:"Vérification du compte échouée. Rien envoyé.",retry:"Renvoyer",discard:"Supprimer",thisChannel:"Ce canal",anotherChannel:"Autre canal",localQueue:"en attente locale",readOnly:"L'envoi et les confirmations restent désactivés avant la validation de la migration.",parity:"Traduction automatique, photos et modération ne sont pas encore équivalentes.",readers:"Lu par",readersFailed:"Confirmations de lecture indisponibles.",noReaders:"Aucune confirmation de lecture.",close:"Fermer"},
 en:{channels:"Channels",loading:"Loading messages…",historyError:"Message history is unavailable. Existing messages were not deleted.",empty:"No messages in this channel.",you:"You",system:"System",moderated:"Message moderated",newMessage:"New message",placeholder:"Write a message…",send:"Send",sent:"Sent",queued:"Saved on this device. Retry when connected.",queueFailed:"Could not queue this message. No delivery was claimed.",allSent:"All queued messages sent",partial:"Some messages still queued locally",stillQueued:"Messages still queued locally.",accountFailed:"Offline account check failed. Nothing sent.",retry:"Retry delivery",discard:"Discard",thisChannel:"This channel",anotherChannel:"Another channel",localQueue:"queued locally",readOnly:"Message sending and read receipts are disabled until migration parity tests pass.",parity:"Automatic chat translation, photos and moderation are not yet at full parity.",readers:"Read by",readersFailed:"Read receipts unavailable.",noReaders:"No read receipts yet.",close:"Close"},
 de:{channels:"Kanäle",loading:"Nachrichten werden geladen…",historyError:"Verlauf nicht verfügbar. Bestehende Nachrichten wurden nicht gelöscht.",empty:"Keine Nachrichten in diesem Kanal.",you:"Du",system:"System",moderated:"Nachricht moderiert",newMessage:"Neue Nachricht",placeholder:"Nachricht schreiben…",send:"Senden",sent:"Gesendet",queued:"Auf diesem Gerät gespeichert. Bei Verbindung erneut versuchen.",queueFailed:"Nachricht konnte nicht gespeichert werden. Nichts gesendet.",allSent:"Alle wartenden Nachrichten gesendet",partial:"Einige Nachrichten warten noch lokal",stillQueued:"Nachrichten warten auf Versand.",accountFailed:"Kontoprüfung fehlgeschlagen. Nichts gesendet.",retry:"Erneut senden",discard:"Verwerfen",thisChannel:"Dieser Kanal",anotherChannel:"Anderer Kanal",localQueue:"lokal wartend",readOnly:"Senden und Lesebestätigungen bleiben bis zur Freigabe der Migration deaktiviert.",parity:"Automatische Übersetzung, Fotos und Moderation sind noch nicht vollständig migriert.",readers:"Gelesen von",readersFailed:"Lesebestätigungen nicht verfügbar.",noReaders:"Noch keine Lesebestätigungen.",close:"Schließen"}
} as const
export function chatCopy(locale:Locale){return copy[locale]}
