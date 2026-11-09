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
  {id:"peppol",state:configuredValue(env.BILLIT_SANDBOX_PARTY_ID)&&configuredValue(env.BILLIT_SANDBOX_API_KEY)?"credentials_present":"provider_required",setupVariables:["BILLIT_SANDBOX_PARTY_ID","BILLIT_SANDBOX_API_KEY"],docsUrl:"https://docs.billit.be/docs/sandbox-vs-production-1"},
  {id:"weeztix",state:env.WEEZTIX_SCANNING_ENABLED==="true"&&configuredValue(env.WEEZTIX_ACCESS_TOKEN)&&configuredValue(env.WEEZTIX_ACTIVE_EVENT_ID)?"credentials_present":"manual_available",setupVariables:["WEEZTIX_ACCESS_TOKEN","WEEZTIX_ACTIVE_EVENT_ID","WEEZTIX_SCANNING_ENABLED"],docsUrl:"https://docs.weeztix.com/docs/introduction/authentication/create-client/"},
  {id:"eventix",state:"manual_available",setupVariables:[],docsUrl:"https://dashboard.weeztix.com"},
  {id:"sumup",state:configuredValue(env.SUMUP_API_KEY)&&configuredValue(env.SUMUP_MERCHANT_CODE)?"credentials_present":"manual_available",setupVariables:["SUMUP_API_KEY","SUMUP_MERCHANT_CODE"],docsUrl:"https://developer.sumup.com/tools/authorization/api-keys/"},
  {id:"banking",state:configuredValue(env.PONTO_CLIENT_ID)&&configuredValue(env.PONTO_CLIENT_SECRET)?"credentials_present":"manual_available",setupVariables:["PONTO_CLIENT_ID","PONTO_CLIENT_SECRET"],docsUrl:"https://pontosupport.isabel.eu/en-US/knowledgebase/article/KA-02515"}
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
   peppol:"Aanbevolen: Billit sandbox. Registreer je bedrijf, activeer Peppol en vraag API-toegang aan. UBL-voorbereiding bestaat; live verzending is nog niet ingeschakeld.",
   weeztix:"De QR-camera zit rechtstreeks in de inkomwerkplek. Voor echte toegang: stel een server-token en het interne event-ID in en activeer scannen uitdrukkelijk. Alleen de Weeztix-server bevestigt toegang; de officiële app blijft offline reserve.",
   eventix:"Evenementkoppelingen en gecontroleerde CSV-import bestaan al. Automatische API-synchronisatie vereist een providercontract en API-documentatie.",
   sumup:"Maak een SumUp testmerchant, een geheime server-API-sleutel en noteer de merchantcode. De koppeling blijft read-only/import tot echte transacties en boekingsafstemming getest zijn.",
   banking:"Zonder extra kosten: bankafschriften via bestaande import. Voor automatische Belgische bankmutaties: Ponto met PSD2-banktoestemming. De connector moet apart gevalideerd worden; geef nooit je bankwachtwoord aan UpTillDawn."
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
   peppol:"Recommandé : Billit sandbox. Enregistrez l'entreprise, activez Peppol et demandez l'accès API. Préparation UBL disponible ; envoi réel désactivé.",
   weeztix:"Caméra QR intégrée au poste Entrée. Configurez un jeton serveur et l'identifiant de l'événement, puis activez explicitement. Seul Weeztix confirme l'entrée ; application officielle en secours hors ligne.",
   eventix:"Les associations d'événements et l'import CSV validé sont disponibles. La synchronisation API exige un accord et une documentation du prestataire.",
   sumup:"Créez un marchand SumUp sandbox, une clé API serveur et relevez le code marchand. La synchronisation réelle reste désactivée avant les tests de transactions.",
   banking:"Sans coût API : importez les relevés. Pour synchronisation bancaire belge automatique, utilisez Ponto et le consentement PSD2 ; un connecteur validé reste nécessaire."
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
   peppol:"Recommended: Billit sandbox. Register your company, enable Peppol and request API access. UBL preparation works; live delivery is not enabled.",
   weeztix:"QR camera is integrated in the entrance workplace. Configure a server token and the internal event ID, then enable scanning explicitly. Only Weeztix confirms admission; the official app remains the offline fallback.",
   eventix:"Event mappings and validated CSV imports are available. Automatic API synchronization requires a provider agreement and technical documentation.",
   sumup:"Create a SumUp sandbox merchant, server-only API key, and note the merchant code. Live syncing remains disabled until transaction and settlement tests pass.",
   banking:"No extra API cost: import bank statements. For automated Belgian bank synchronization, use Ponto with PSD2 bank consent. A verified connector is still required."
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
   peppol:"Empfohlen: Billit-Sandbox. Unternehmen registrieren, Peppol aktivieren und API-Zugang beantragen. UBL-Vorbereitung funktioniert; Live-Versand ist deaktiviert.",
   weeztix:"Die QR-Kamera ist direkt im Einlass-Arbeitsplatz. Server-Token und interne Event-ID konfigurieren und Scannen ausdrücklich aktivieren. Nur Weeztix bestätigt Einlass; offizielle App als Offline-Reserve.",
   eventix:"Event-Zuordnungen und geprüfter CSV-Import sind verfügbar. Automatische API-Synchronisation erfordert Anbietervereinbarung und Dokumentation.",
   sumup:"SumUp-Sandbox-Händler, geheimen Server-API-Schlüssel und Händlercode erstellen. Live-Abgleich erst nach Transaktions- und Auszahlungstests aktivieren.",
   banking:"Ohne API-Kosten: Kontoauszüge importieren. Für automatischen belgischen Bankabgleich Ponto mit PSD2-Zustimmung wählen; Connector muss gesondert validiert werden."
  }
 }
} as const
