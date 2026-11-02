import type {SupportedUiLocale} from "@/lib/locale-preferences"
const title="Eventix / Weeztix"
const copy={
 nl:{status:"API-koppeling niet actief",detail:"Automatische synchronisatie is nog niet geconfigureerd. Importeer ticketverkopen voorlopig via CSV.",requirement:"Live synchronisatie vereist API-toegang, evenementkoppeling en gecontroleerde synchronisatie."},
 fr:{status:"Connexion API inactive",detail:"La synchronisation automatique n’est pas configurée. Importez les ventes par CSV pour le moment.",requirement:"La synchronisation nécessite un accès API, une association des événements et une validation."},
 en:{status:"API connection inactive",detail:"Automatic synchronization is not configured. Import ticket sales through CSV for now.",requirement:"Live sync requires API access, event mapping and verified synchronization."},
 de:{status:"API-Verbindung inaktiv",detail:"Die automatische Synchronisierung ist nicht eingerichtet. Importieren Sie Ticketverkäufe vorerst per CSV.",requirement:"Live-Synchronisierung erfordert API-Zugang, Ereigniszuordnung und geprüfte Synchronisierung."}
} as const
export default function EventixIntegration({locale}:{locale:SupportedUiLocale}){
 const t=copy[locale]
 return <section className="space-y-2 rounded-2xl border bg-card p-5" aria-label={title}>
  <h2 className="text-lg font-semibold">{title}</h2>
  <p role="status" className="text-sm font-semibold">{t.status}</p>
  <p className="text-sm">{t.detail}</p>
  <p className="text-sm text-muted-foreground">{t.requirement}</p>
 </section>
}
