import type {Locale} from "./i18n"

// Match the existing authoritative entrance-post vocabulary. UI visibility
// never grants access; the database independently enforces event/post/shift.
export function isEntranceWorkplace(name:string):boolean{
 if(typeof name!=="string"||name.length>160)return false
 const normalized=name.normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .toLowerCase().trim().replace(/\s+/g," ")
 const entrance=new Set(["inkom","entrance","entree","eingang","toegang",
  "ticket scan","ticket scanning","ticketscan","ticket scanner",
  "ticketcontrole","ticketkontrolle","controle des billets"])
 const parts=normalized.split(/\s*(?:\/|&|\+|\||[-–—])\s*/)
 return parts.some(part=>entrance.has(part))&&
  parts.every(part=>entrance.has(part)||part==="guestlist"||part==="guest list")
}
// No QR containing a URL, free text, control char or oversized bearer value.
export function validWeeztixBarcode(value:unknown):value is string{
 return typeof value==="string"&&value.length>=6&&value.length<=160&&
  /^[a-zA-Z0-9_-]+$/.test(value)
}
export const scanCopy={
 nl:{title:"Weeztix-tickets scannen",open:"Scanner openen",close:"Scanner sluiten",start:"Camera starten",stop:"Camera stoppen",manual:"Ticketcode handmatig",verify:"Ticket controleren",ready:"Richt de camera op de QR-code.",loading:"Controleren bij Weeztix…",cameraError:"Geen cameratoegang. Gebruik de handmatige code.",denied:"Geen toegang: alleen bevoegde inkomcrew.",inactive:"De nieuwe scanner is nog niet vrijgegeven; gebruik de bestaande scanner.",invalid:"Voer een geldige Weeztix-ticketcode in.",accepted:"GOEDGEKEURD — TOEGANG",rejected:"GEWEIGERD — GEEN TOEGANG",unknown:"Geen bevestiging van Weeztix. Geen toegang verlenen.",noConfig:"Weeztix is nog niet gekoppeld aan dit event.",duplicate:"Deze code werd zojuist verwerkt; scan niet opnieuw.",loadingDecoder:"QR-lezer voorbereiden…",note:"QR herkennen is geen toegangscontrole. Alleen een online bevestiging van Weeztix geeft toegang.",retry:"Controleer de status bij Weeztix vóór je opnieuw probeert."},
 fr:{title:"Scanner les billets Weeztix",open:"Ouvrir le scanner",close:"Fermer le scanner",start:"Démarrer la caméra",stop:"Arrêter la caméra",manual:"Code billet manuel",verify:"Vérifier le billet",ready:"Présentez le QR code à la caméra.",loading:"Vérification chez Weeztix…",cameraError:"Caméra indisponible. Utilisez le code manuel.",denied:"Accès refusé : personnel d’entrée autorisé uniquement.",inactive:"Nouveau scanner non activé ; utilisez le scanner existant.",invalid:"Code Weeztix invalide.",accepted:"ACCEPTÉ — ENTRÉE",rejected:"REFUSÉ — PAS D’ENTRÉE",unknown:"Aucune confirmation Weeztix. Ne laissez pas entrer.",noConfig:"Weeztix n’est pas lié à cet événement.",duplicate:"Code déjà traité ; ne pas rescanner.",loadingDecoder:"Préparation du lecteur QR…",note:"La lecture QR ne permet pas l’entrée. Seule la validation Weeztix en ligne fait foi.",retry:"Vérifiez le statut chez Weeztix avant de réessayer."},
 en:{title:"Scan Weeztix tickets",open:"Open scanner",close:"Close scanner",start:"Start camera",stop:"Stop camera",manual:"Manual ticket barcode",verify:"Verify ticket",ready:"Point the camera at the QR code.",loading:"Checking with Weeztix…",cameraError:"Camera unavailable. Use manual entry.",denied:"Access denied: authorized entrance crew only.",inactive:"New scanner not enabled yet; use the existing scanner.",invalid:"Enter a valid Weeztix barcode.",accepted:"APPROVED — ADMIT",rejected:"REJECTED — DO NOT ADMIT",unknown:"No Weeztix confirmation. Do not admit.",noConfig:"Weeztix is not linked to this event.",duplicate:"Code just processed; do not re-scan.",loadingDecoder:"Loading QR reader…",note:"Decoding a QR code does not grant entry. Only live Weeztix approval does.",retry:"Check the ticket status with Weeztix before retrying."},
 de:{title:"Weeztix-Tickets scannen",open:"Scanner öffnen",close:"Scanner schließen",start:"Kamera starten",stop:"Kamera stoppen",manual:"Ticketcode manuell",verify:"Ticket prüfen",ready:"QR-Code vor die Kamera halten.",loading:"Prüfung bei Weeztix…",cameraError:"Kamera nicht verfügbar. Code manuell eingeben.",denied:"Kein Zugang: nur autorisiertes Einlasspersonal.",inactive:"Neuer Scanner noch nicht freigegeben; bisherigen Scanner nutzen.",invalid:"Ungültiger Weeztix-Code.",accepted:"FREIGEGEBEN — EINLASS",rejected:"ABGELEHNT — KEIN EINLASS",unknown:"Keine Weeztix-Bestätigung. Kein Einlass.",noConfig:"Weeztix ist für dieses Event nicht verbunden.",duplicate:"Code bereits verarbeitet; nicht erneut scannen.",loadingDecoder:"QR-Leser wird geladen…",note:"QR-Erkennung erlaubt keinen Einlass. Nur die Online-Bestätigung von Weeztix zählt.",retry:"Vor erneutem Versuch Status bei Weeztix prüfen."}
} as const satisfies Record<Locale,Record<string,string>>
export type ScanResult={ok:boolean;code:"admitted"|"invalid_request"|"forbidden"|"unauthorized"|
 "not_configured"|"provider_rejected"|"ticket_not_found"|"provider_denied"|
 "provider_auth_expired"|"provider_auth_refreshing"|"provider_busy"|
 "provider_unavailable"|"scanner_disabled"|"authorization_unavailable"|"unknown"}
export function scanNotice(result:ScanResult,locale:Locale):string{
 const c=scanCopy[locale]
 if(result.ok&&result.code==="admitted")return c.accepted
 if(result.code==="invalid_request")return c.invalid
 if(result.code==="forbidden"||result.code==="unauthorized")return c.denied
 if(result.code==="not_configured"||result.code==="scanner_disabled")return c.noConfig
 if(result.code==="provider_rejected"||result.code==="ticket_not_found"||result.code==="provider_denied")return c.rejected
 return c.unknown
}
