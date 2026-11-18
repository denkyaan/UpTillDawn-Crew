export const languages=["nl","fr","en","de"] as const
export type Locale=typeof languages[number]
const labels={
 nl:{home:"Overzicht",events:"Evenementen",tasks:"Taken",chat:"Chats",finance:"Financiën",login:"Aanmelden",logout:"Afmelden",loading:"Laden…",unavailable:"Tijdelijk niet beschikbaar",offline:"Offline — laatst bewaarde gegevens",noData:"Geen gegevens beschikbaar",portal:"Portalen",readOnly:"Leesweergave — bestaande schrijfworkflows blijven in de huidige app",status:"Status",refresh:"Vernieuwen"},
 fr:{home:"Accueil",events:"Événements",tasks:"Tâches",chat:"Discussions",finance:"Finances",login:"Connexion",logout:"Déconnexion",loading:"Chargement…",unavailable:"Temporairement indisponible",offline:"Hors ligne — dernières données enregistrées",noData:"Aucune donnée",portal:"Portails",readOnly:"Lecture seule — les opérations restent dans l’application actuelle",status:"Statut",refresh:"Actualiser"},
 en:{home:"Overview",events:"Events",tasks:"Tasks",chat:"Chats",finance:"Finance",login:"Sign in",logout:"Sign out",loading:"Loading…",unavailable:"Temporarily unavailable",offline:"Offline — last saved data",noData:"No data available",portal:"Portals",readOnly:"Read-only — existing write workflows remain in the current app",status:"Status",refresh:"Refresh"},
 de:{home:"Übersicht",events:"Veranstaltungen",tasks:"Aufgaben",chat:"Chats",finance:"Finanzen",login:"Anmelden",logout:"Abmelden",loading:"Laden…",unavailable:"Vorübergehend nicht verfügbar",offline:"Offline — zuletzt gespeicherte Daten",noData:"Keine Daten vorhanden",portal:"Portale",readOnly:"Nur Lesen — Schreibvorgänge verbleiben in der bestehenden App",status:"Status",refresh:"Aktualisieren"},
} as const
export function resolveLocale(raw:string|undefined):Locale{const v=String(raw||"").slice(0,2).toLowerCase();return (languages as readonly string[]).includes(v)?v as Locale:"nl"}
export function deviceLocale():Locale{if(typeof navigator==="undefined")return "nl";return resolveLocale(navigator.languages?.[0]||navigator.language)}
export function copy(locale:Locale){return labels[locale]}
