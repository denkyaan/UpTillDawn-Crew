/**
 * Server-side, disclosure-safe integration readiness.
 * Credential presence never means a successful live integration.
 */
export type IntegrationId="cloudmersive"|"documenso"|"peppol"|"weeztix"|"eventix"|"sumup"|"banking"
export type IntegrationState="needs_configuration"|"credentials_present"|"provider_required"|"manual_available"
export type IntegrationReadiness={id:IntegrationId;state:IntegrationState;setupVariables:readonly string[];docsUrl:string|null}
type Environment=Readonly<Record<string,string|undefined>>

function configuredValue(value:unknown):boolean{
 return typeof value==="string"&&value.trim().length>0
}
function configuredDocumensoOrigin(raw:string|undefined):boolean{
 if(!configuredValue(raw))return false
 try{
  const url=new URL(raw!)
  if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash||url.pathname!=="/")return false
  const host=url.hostname.toLowerCase()
  if(!host||host==="localhost"||host.endsWith(".localhost")||host.endsWith(".local")||host==="[::1]"||host==="[::]"||host.startsWith("[fc")||host.startsWith("[fd")||host.startsWith("[fe80"))return false
  const octets=host.split(".").map(Number)
  if(octets.length===4&&octets.every(n=>Number.isInteger(n)&&n>=0&&n<=255)){
   if(octets[0]===0||octets[0]===10||octets[0]===127||octets[0]===169&&octets[1]===254||octets[0]===172&&octets[1]>=16&&octets[1]<=31||octets[0]===192&&octets[1]===168)return false
  }
  return true
 }catch{return false}
}
export function externalServicesReadiness(env:Environment):IntegrationReadiness[]{
 return [
  {id:"cloudmersive",state:configuredValue(env.CLOUDMERSIVE_OCR_API_KEY)?"credentials_present":"needs_configuration",
   setupVariables:["CLOUDMERSIVE_OCR_API_KEY"],docsUrl:"https://api.cloudmersive.com/docs/ocr.asp"},
  {id:"documenso",state:configuredDocumensoOrigin(env.DOCUMENSO_BASE_URL)&&configuredValue(env.DOCUMENSO_API_KEY)?"credentials_present":"needs_configuration",
   setupVariables:["DOCUMENSO_BASE_URL","DOCUMENSO_API_KEY"],docsUrl:"https://docs.documenso.com/docs/developers/getting-started/authentication"},
  {id:"peppol",state:"provider_required",setupVariables:[],docsUrl:"https://peppol.org/members/peppol-certified-service-providers/"},
  {id:"weeztix",state:"manual_available",setupVariables:[],docsUrl:"https://weeztix.com/help/create-scanner-login"},
  {id:"eventix",state:"manual_available",setupVariables:[],docsUrl:"https://dashboard.weeztix.com"},
  {id:"sumup",state:"manual_available",setupVariables:[],docsUrl:"https://developer.sumup.com/tools/authorization/api-keys/"},
  {id:"banking",state:"manual_available",setupVariables:[],docsUrl:null}
 ]
}
export const externalServicesCopy={
 nl:{
  title:"Externe diensten · aansluitstatus",
  intro:"Configuratiecontrole op de server. Aanwezige sleutels bewijzen geen werkende verbinding. Geen geheime waarden worden getoond.",
  link:"Officiële instructies",
  states:{
   needs_configuration:"Configuratie nodig",
   credentials_present:"Instellingen aanwezig · nog niet live getest",
   provider_required:"Dienstverlener kiezen",
   manual_available:"Handmatige werkwijze beschikbaar"
  },
  names:{cloudmersive:"Cloudmersive · OCR (optioneel)",documenso:"Documenso · digitaal ondertekenen",peppol:"Peppol · e-facturatie",weeztix:"Weeztix · inkomscan",eventix:"Eventix / Weeztix · ticketverkoop",sumup:"SumUp · merchandising en tokens",banking:"Bank / boekhouding"},
  instructions:{
   cloudmersive:"OCR van foto's en PDF's gebeurt standaard lokaal op het toestel zonder API. Cloudmersive is alleen een optionele externe dienst en niet nodig voor gewone factuurverwerking.",
   documenso:"Kies Documenso Cloud of een afzonderlijke beveiligde installatie, maak een team-API-token aan en stel de HTTPS-basis-URL en sleutel in. Contracten verzenden is nog uitgeschakeld.",
   peppol:"Kies een gecertificeerd Peppol Access Point met API. Registreer het ondernemingsnummer en vraag testtoegang en bezorgbevestigingen aan. UpTillDawn bereidt voorlopig alleen UBL voor.",
   weeztix:"Maak per evenement via Entréemanagement een scannerlogin/QR aan. De crew scant met de officiële Weeztix-app; hier is geen API-sleutel nodig.",
   eventix:"Evenementkoppelingen en gecontroleerde CSV-import bestaan al. Automatische API-synchronisatie vereist een providercontract en API-documentatie.",
   sumup:"Voor één eigen SumUp-merchant kun je in het dashboard een geheime API-sleutel aanmaken. De automatische koppeling is nog niet gebouwd; CSV-import werkt als tussenstap.",
   banking:"Bankafschriften kunnen via gecontroleerde import verwerkt worden. Kies eerst de bank/boekhoudsoftware en de gewenste API-provider voor automatische synchronisatie."
  }
 },
 fr:{
  title:"Services externes · état des connexions",
  intro:"Vérification de la configuration côté serveur. Une clé présente ne prouve pas une connexion valide. Aucun secret n'est affiché.",
  link:"Instructions officielles",
  states:{needs_configuration:"Configuration requise",credentials_present:"Paramètres présents · non vérifiés en direct",provider_required:"Choisir un prestataire",manual_available:"Procédure manuelle disponible"},
  names:{cloudmersive:"Cloudmersive · OCR (facultatif)",documenso:"Documenso · signature numérique",peppol:"Peppol · facturation électronique",weeztix:"Weeztix · contrôle d'entrée",eventix:"Eventix / Weeztix · billetterie",sumup:"SumUp · produits et jetons",banking:"Banque / comptabilité"},
  instructions:{
   cloudmersive:"L'OCR des photos et PDF s'effectue par défaut sur l'appareil sans API. Cloudmersive est facultatif et n'est pas nécessaire pour le traitement standard.",
   documenso:"Choisissez Documenso Cloud ou un hébergement sécurisé séparé, créez un jeton d'équipe et configurez l'URL HTTPS et le secret. L'envoi reste désactivé.",
   peppol:"Choisissez un point d'accès Peppol certifié avec API, enregistrez l'entreprise et demandez l'accès de test et les accusés de livraison. Seule la préparation UBL est disponible.",
   weeztix:"Créez un identifiant/QR scanner par événement dans la gestion des entrées. L'équipe utilise l'application Weeztix officielle; aucune clé API n'est requise.",
   eventix:"Les associations d'événements et l'import CSV validé sont disponibles. La synchronisation API exige un accord et une documentation du prestataire.",
   sumup:"Créez une clé API secrète dans le compte marchand SumUp. La synchronisation automatique n'est pas implémentée; utilisez l'import CSV.",
   banking:"Import contrôlé des relevés disponible. Choisissez d'abord une banque/logiciel comptable et son fournisseur d'API."
  }
 },
 en:{
  title:"External services · connection readiness",
  intro:"Server-side configuration checks only. Stored credentials do not establish a working connection. Secret values are never shown.",
  link:"Official setup instructions",
  states:{needs_configuration:"Configuration required",credentials_present:"Settings present · live connection unverified",provider_required:"Select a provider",manual_available:"Manual workflow available"},
  names:{cloudmersive:"Cloudmersive · OCR (optional)",documenso:"Documenso · e-signatures",peppol:"Peppol · e-invoicing",weeztix:"Weeztix · entrance scanning",eventix:"Eventix / Weeztix · ticketing",sumup:"SumUp · merchandise and tokens",banking:"Banking / accounting"},
  instructions:{
   cloudmersive:"Photo and PDF OCR now runs on the device by default with no API key. Cloudmersive is optional and not required for standard invoice processing.",
   documenso:"Choose Documenso Cloud or a separately secured host, create a team API token, and configure its HTTPS origin and secret. Sending remains disabled.",
   peppol:"Select a certified Peppol Access Point offering an API, register the organization, and request test access and delivery acknowledgements. Only UBL preparation is available.",
   weeztix:"Create a scanner login/QR per event in Entrance Management. Crew members scan using the official Weeztix app; no API key is required.",
   eventix:"Event mappings and validated CSV imports are available. Automatic API synchronization requires a provider agreement and technical documentation.",
   sumup:"Create a secret API key in your SumUp merchant dashboard. The automatic connector is not implemented; use CSV imports in the meantime.",
   banking:"Validated statement imports are available. First select the bank/accounting product and its API provider."
  }
 },
 de:{
  title:"Externe Dienste · Anschlussstatus",
  intro:"Nur serverseitige Konfigurationsprüfung. Gespeicherte Schlüssel beweisen keine funktionierende Verbindung. Geheimnisse werden nicht angezeigt.",
  link:"Offizielle Anleitung",
  states:{needs_configuration:"Konfiguration erforderlich",credentials_present:"Einstellungen vorhanden · Verbindung nicht live geprüft",provider_required:"Dienstleister auswählen",manual_available:"Manueller Ablauf verfügbar"},
  names:{cloudmersive:"Cloudmersive · OCR (optional)",documenso:"Documenso · digitale Signaturen",peppol:"Peppol · E-Rechnungen",weeztix:"Weeztix · Einlasskontrolle",eventix:"Eventix / Weeztix · Ticketverkauf",sumup:"SumUp · Merchandise und Token",banking:"Bank / Buchhaltung"},
  instructions:{
   cloudmersive:"OCR für Fotos und PDF läuft standardmäßig lokal auf dem Gerät ohne API. Cloudmersive ist optional und für die normale Rechnungsverarbeitung nicht erforderlich.",
   documenso:"Documenso Cloud oder separaten sicheren Host wählen, Team-Token erstellen und HTTPS-URL sowie Schlüssel konfigurieren. Versand bleibt deaktiviert.",
   peppol:"Zertifizierten Peppol Access Point mit API auswählen, Unternehmen registrieren und Testzugang sowie Zustellbestätigungen anfordern. Bisher nur UBL-Vorbereitung.",
   weeztix:"Je Veranstaltung Scanner-Anmeldung/QR in der Einlassverwaltung erstellen. Die Crew scannt mit der offiziellen Weeztix-App ohne API-Schlüssel.",
   eventix:"Event-Zuordnungen und geprüfter CSV-Import sind verfügbar. Automatische API-Synchronisation erfordert Anbietervereinbarung und Dokumentation.",
   sumup:"Geheimen API-Schlüssel im SumUp-Händlerkonto erstellen. Der automatische Connector fehlt noch; bis dahin CSV-Import verwenden.",
   banking:"Geprüfter Kontoauszugsimport verfügbar. Zuerst Bank/Buchhaltungssoftware und API-Anbieter wählen."
  }
 }
} as const
