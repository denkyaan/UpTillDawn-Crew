/**
 * Server-side, disclosure-safe integration readiness.
 * Credential presence never means a successful live integration.
 */
export type IntegrationId="cloudmersive"|"documenso"|"peppol"|"weeztix"|"eventix"|"eventpay"|"sumup"|"banking"
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
  // EventPay processes the actual prepaid RFID/QR Bar, Merch and Token cashless payments.
  // No public API contract has been validated for charging or top-up, so this
  // information-only entry must never suggest a working payment integration.
  {id:"eventpay",state:"provider_required",setupVariables:[],docsUrl:"https://eventpay.be/integraties/"},
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
  names:{cloudmersive:"Cloudmersive · OCR (optioneel)",documenso:"Documenso · digitaal ondertekenen",peppol:"Peppol · e-facturatie",weeztix:"Weeztix · inkomscan",eventix:"Eventix / Weeztix · ticketverkoop",eventpay:"EventPay · Bar, Merch en Tokens",sumup:"SumUp · overige betaalstromen",banking:"Bank / boekhouding"},
  instructions:{
   cloudmersive:"OCR van foto's en PDF's gebeurt standaard lokaal op het toestel zonder API. Cloudmersive is alleen een optionele externe dienst en niet nodig voor gewone factuurverwerking.",
   documenso:"Documenso vereist momenteel een leverancier-API-token voor integraties. UpTillDawn kan nog geen veilige login-en-toestemmingkoppeling aanbieden; vraag geen sleutel aan de Maker. Contracten verzenden blijft uit.",
   peppol:"Klik Verbinden en meld je bij Billit aan. Billit vraagt jouw toestemming; UpTillDawn bewaart de tokens versleuteld. UpTillDawn moet als app vooraf bij Billit geregistreerd zijn. Peppol-verzending blijft uit tot leveranciersacceptatie.",
   weeztix:"Kies het UpTillDawn-evenement en meld je aan bij Weeztix. UpTillDawn regelt de clienttoegang centraal; je hoeft geen token of API-sleutel te kennen. Alleen Weeztix bevestigt inkomscans.",
   eventix:"Evenementkoppelingen en gecontroleerde CSV-import bestaan al. Automatische API-synchronisatie vereist een providercontract en API-documentatie.",
   eventpay:"EventPay beheert RFID-/QR-saldo, Tokens, Bar en Merch. Voor automatische koppeling is een officiële EventPay-integratie vereist; de beheerder hoeft geen API-sleutels te bezorgen. Tot dan is alleen EventPay zelf de bevestigde betaalbron.",
   sumup:"Klik Verbinden en meld je aan bij je eigen SumUp-account om de koppeling toestemming te geven. Geen merchantcode of API-sleutel nodig. Betalingsverwerking vergt aparte SumUp-goedkeuring.",
   banking:"Ponto vereist eerst een officiële UpTillDawn-integratie bij de aanbieder. Daarna autoriseert de beheerder zelf de bank in Ponto via PSD2; bankwachtwoorden worden nooit gevraagd. Tot dan blijft bankafschriftimport beschikbaar."
  }
 },
 fr:{
  title:"Services externes · état des connexions",
  intro:"Vérification de la configuration côté serveur. Une clé présente ne prouve pas une connexion valide. Aucun secret n'est affiché.",
  link:"Instructions officielles",
  states:{needs_configuration:"Configuration requise",credentials_present:"Paramètres présents · non vérifiés en direct",provider_required:"Choisir un prestataire",manual_available:"Procédure manuelle disponible"},
  names:{cloudmersive:"Cloudmersive · OCR (facultatif)",documenso:"Documenso · signature numérique",peppol:"Peppol · facturation électronique",weeztix:"Weeztix · contrôle d'entrée",eventix:"Eventix / Weeztix · billetterie",eventpay:"EventPay · Bar, Merch et rechargements",sumup:"SumUp · autres paiements",banking:"Banque / comptabilité"},
  instructions:{
   cloudmersive:"L'OCR des photos et PDF s'effectue par défaut sur l'appareil sans API. Cloudmersive est facultatif et n'est pas nécessaire pour le traitement standard.",
   documenso:"Documenso exige actuellement un jeton API pour l'intégration. Aucune connexion par consentement n'est vérifiée; ne demandez pas de clé au créateur. L'envoi de contrats reste désactivé.",
   peppol:"Cliquez sur Connecter et autorisez UpTillDawn depuis votre compte Billit. Les jetons sont chiffrés; l'application doit être enregistrée auprès de Billit. L'envoi Peppol exige encore une validation.",
   weeztix:"Choisissez l'événement et connectez-vous à Weeztix pour autoriser l'accès. Aucun jeton ou secret client n'est demandé. Seul Weeztix valide les scans.",
   eventix:"Les associations d'événements et l'import CSV validé sont disponibles. La synchronisation API exige un accord et une documentation du prestataire.",
   eventpay:"EventPay gère les cartes RFID/QR, le bar, le merch et les rechargements. L'automatisation nécessite une intégration officielle. Aucun secret n'est demandé au client.",
   sumup:"Cliquez sur Connecter et autorisez l'accès avec votre compte SumUp. Aucune clé API ni code commerçant à saisir. Les paiements nécessitent une approbation distincte de SumUp.",
   banking:"UpTillDawn doit d'abord activer une intégration officielle Ponto. Le responsable autorise ensuite sa banque via PSD2, sans partager de mot de passe. L'import de relevés reste disponible."
  }
 },
 en:{
  title:"External services · connection readiness",
  intro:"Server-side configuration checks only. Stored credentials do not establish a working connection. Secret values are never shown.",
  link:"Official setup instructions",
  states:{needs_configuration:"Configuration required",credentials_present:"Settings present · live connection unverified",provider_required:"Select a provider",manual_available:"Manual workflow available"},
  names:{cloudmersive:"Cloudmersive · OCR (optional)",documenso:"Documenso · e-signatures",peppol:"Peppol · e-invoicing",weeztix:"Weeztix · entrance scanning",eventix:"Eventix / Weeztix · ticketing",eventpay:"EventPay · Bar, Merch and top-ups",sumup:"SumUp · other payments",banking:"Banking / accounting"},
  instructions:{
   cloudmersive:"Photo and PDF OCR now runs on the device by default with no API key. Cloudmersive is optional and not required for standard invoice processing.",
   documenso:"Documenso currently requires an API token for third-party integration. No verified third-party account-consent login is available; never ask the Maker for customer keys. Signing dispatch stays disabled.",
   peppol:"Click Connect and sign into your Billit account to authorize UpTillDawn. Tokens are encrypted and the application must first be registered with Billit. Peppol delivery remains subject to provider acceptance.",
   weeztix:"Choose the event and sign in at Weeztix to approve access. No API key or OAuth client secret is requested from you. Only Weeztix verifies admission scans.",
   eventix:"Event mappings and validated CSV imports are available. Automatic API synchronization requires a provider agreement and technical documentation.",
   eventpay:"EventPay owns RFID/QR wallet balances, Bar, Merch and top-ups. Automation requires a verified official EventPay integration. No customer API key is required; EventPay remains the payment source.",
   sumup:"Click Connect and sign into your SumUp merchant account to grant consent. No API key or merchant code is required from you. Payments need separate SumUp approval.",
   banking:"UpTillDawn must first register its Ponto software integration. The account owner then consents to bank access via PSD2; no bank password is collected. Statement import remains available."
  }
 },
 de:{
  title:"Externe Dienste · Anschlussstatus",
  intro:"Nur serverseitige Konfigurationsprüfung. Gespeicherte Schlüssel beweisen keine funktionierende Verbindung. Geheimnisse werden nicht angezeigt.",
  link:"Offizielle Anleitung",
  states:{needs_configuration:"Konfiguration erforderlich",credentials_present:"Einstellungen vorhanden · Verbindung nicht live geprüft",provider_required:"Dienstleister auswählen",manual_available:"Manueller Ablauf verfügbar"},
  names:{cloudmersive:"Cloudmersive · OCR (optional)",documenso:"Documenso · digitale Signaturen",peppol:"Peppol · E-Rechnungen",weeztix:"Weeztix · Einlasskontrolle",eventix:"Eventix / Weeztix · Ticketverkauf",eventpay:"EventPay · Bar, Merch und Aufladungen",sumup:"SumUp · weitere Zahlungen",banking:"Bank / Buchhaltung"},
  instructions:{
   cloudmersive:"OCR für Fotos und PDF läuft standardmäßig lokal auf dem Gerät ohne API. Cloudmersive ist optional und für die normale Rechnungsverarbeitung nicht erforderlich.",
   documenso:"Documenso benötigt derzeit für Fremdintegrationen ein API-Token. Eine sichere Kontoautorisierung ist noch nicht nachgewiesen; keine Kundenschlüssel vom Maker verlangen. Signaturversand bleibt deaktiviert.",
   peppol:"Auf Verbinden klicken und sich bei Billit anmelden, um UpTillDawn zu autorisieren. Tokens werden verschlüsselt; die App benötigt vorher eine Billit-Registrierung. Peppol-Versand bleibt gesperrt.",
   weeztix:"Event auswählen und sich bei Weeztix anmelden. Kundenseitige API-Schlüssel sind nicht nötig. Nur Weeztix bestätigt Einlassscans.",
   eventix:"Event-Zuordnungen und geprüfter CSV-Import sind verfügbar. Automatische API-Synchronisation erfordert Anbietervereinbarung und Dokumentation.",
   eventpay:"EventPay verwaltet RFID/QR-Guthaben, Bar, Merch und Aufladungen. Eine Automatisierung benötigt eine geprüfte offizielle Integration; keine Kundenschlüssel erforderlich.",
   sumup:"Auf Verbinden klicken und sich im SumUp-Konto anmelden, um Zugriff zu erlauben. Kein API-Schlüssel oder Händlercode erforderlich. Für Zahlungen ist eine gesonderte Zulassung nötig.",
   banking:"UpTillDawn muss zuerst eine offizielle Ponto-Integration registrieren. Danach genehmigt der Kunde den Bankzugriff über PSD2, ohne Bankpasswort weiterzugeben. Kontoauszugsimport bleibt nutzbar."
  }
 }
} as const
