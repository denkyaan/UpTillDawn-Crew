"use client"

import {useEffect,useState,useSyncExternalStore} from "react"
import type {SupportedUiLocale} from "@/lib/locale-preferences"
import {activeUiLocale,LANGUAGE_APPLIED_EVENT} from "@/lib/locale-preferences"
import {integrationFields,integrationProviders,type IntegrationProvider,type IntegrationSummary} from "@/lib/administration/integration-credentials"

const names={sumup:"SumUp",documenso:"Documenso",banking:"Ponto",weeztix:"Weeztix",peppol:"Billit / Peppol"} as const
const labels={
 nl:{SUMUP_API_KEY:"Geheime API-sleutel",SUMUP_MERCHANT_CODE:"Merchantcode",DOCUMENSO_BASE_URL:"Documenso HTTPS-adres",DOCUMENSO_API_KEY:"Documenso API-token",PONTO_CLIENT_ID:"Client ID",PONTO_CLIENT_SECRET:"Client Secret",WEEZTIX_ACCESS_TOKEN:"Weeztix access-token",WEEZTIX_ACTIVE_EVENT_ID:"UpTillDawn event-ID (UUID)",BILLIT_SANDBOX_PARTY_ID:"Billit sandbox Party ID",BILLIT_SANDBOX_API_KEY:"Billit sandbox API-sleutel",WEEZTIX_SCANNING_ENABLED:"Inkomscanner voor dit event activeren",WEEZTIX_CLIENT_ID:"Weeztix OAuth Client ID",WEEZTIX_CLIENT_SECRET:"Weeztix OAuth Client Secret"},
 fr:{SUMUP_API_KEY:"Clé API secrète",SUMUP_MERCHANT_CODE:"Code marchand",DOCUMENSO_BASE_URL:"Adresse HTTPS Documenso",DOCUMENSO_API_KEY:"Jeton API Documenso",PONTO_CLIENT_ID:"Identifiant client",PONTO_CLIENT_SECRET:"Secret client",WEEZTIX_ACCESS_TOKEN:"Jeton d'accès Weeztix",WEEZTIX_ACTIVE_EVENT_ID:"ID événement UpTillDawn (UUID)",BILLIT_SANDBOX_PARTY_ID:"Billit sandbox Party ID",BILLIT_SANDBOX_API_KEY:"Clé API sandbox Billit",WEEZTIX_SCANNING_ENABLED:"Activer le scanner d’entrée pour cet événement",WEEZTIX_CLIENT_ID:"Identifiant client OAuth Weeztix",WEEZTIX_CLIENT_SECRET:"Secret client OAuth Weeztix"},
 en:{SUMUP_API_KEY:"Secret API key",SUMUP_MERCHANT_CODE:"Merchant code",DOCUMENSO_BASE_URL:"Documenso HTTPS URL",DOCUMENSO_API_KEY:"Documenso API token",PONTO_CLIENT_ID:"Client ID",PONTO_CLIENT_SECRET:"Client Secret",WEEZTIX_ACCESS_TOKEN:"Weeztix access token",WEEZTIX_ACTIVE_EVENT_ID:"UpTillDawn event ID (UUID)",BILLIT_SANDBOX_PARTY_ID:"Billit sandbox Party ID",BILLIT_SANDBOX_API_KEY:"Billit sandbox API key",WEEZTIX_SCANNING_ENABLED:"Enable entrance scanning for this event",WEEZTIX_CLIENT_ID:"Weeztix OAuth Client ID",WEEZTIX_CLIENT_SECRET:"Weeztix OAuth Client Secret"},
 de:{SUMUP_API_KEY:"Geheimer API-Schlüssel",SUMUP_MERCHANT_CODE:"Händlercode",DOCUMENSO_BASE_URL:"Documenso HTTPS-Adresse",DOCUMENSO_API_KEY:"Documenso API-Token",PONTO_CLIENT_ID:"Client ID",PONTO_CLIENT_SECRET:"Client Secret",WEEZTIX_ACCESS_TOKEN:"Weeztix Zugriffstoken",WEEZTIX_ACTIVE_EVENT_ID:"UpTillDawn Event-ID (UUID)",BILLIT_SANDBOX_PARTY_ID:"Billit Sandbox Party ID",BILLIT_SANDBOX_API_KEY:"Billit Sandbox API-Schlüssel",WEEZTIX_SCANNING_ENABLED:"Einlassscanner für dieses Event aktivieren",WEEZTIX_CLIENT_ID:"Weeztix OAuth Client ID",WEEZTIX_CLIENT_SECRET:"Weeztix OAuth Client Secret"}
} as const
const copy={
 nl:{title:"Accountgegevens veilig beheren",intro:"Hoofdadmin en Administratie gebruiken dezelfde verbindingen. Sleutels worden versleuteld en zijn na opslaan niet terug te lezen.",provider:"Dienst",configured:"Veilig opgeslagen",missing:"Nog niet gekoppeld",choose:"Kies een dienst",save:"Opslaan of vervangen",remove:"Ontkoppelen",confirm:"Definitief ontkoppelen",cancel:"Annuleren",busy:"Bezig met beveiligen…",saved:"Instellingen veilig opgeslagen. Test de verbinding hieronder.",removed:"Verbinding ontkoppeld. De oude sleutel is gewist.",unavailable:"Opslag tijdelijk niet beschikbaar.",invalid:"Controleer de ingevulde gegevens.",forbidden:"Je hebt geen bevoegdheid om deze dienst aan te passen.",keyMissing:"Eenmalige serverbeveiligingssleutel ontbreekt. De Maker moet UPT_INTEGRATION_ENCRYPTION_KEY als Cloudflare-secret instellen.",last:"Laatst aangepast",warning:"Opslaan activeert geen betalingen, Peppol-verzending of banksynchronisatie. Weeztix-tokens moeten nog automatisch vernieuwd worden.",auditTitle:"Integratiewijzigingen",auditEmpty:"Nog geen wijzigingen geregistreerd.",auditConnected:"Gekoppeld",auditUpdated:"Gewijzigd",auditDisconnected:"Ontkoppeld",auditBy:"door",oauthConnect:"Weeztix veilig verbinden",oauthHelp:"Sla eerst de OAuth Client ID en Client Secret op. Meld daarna aan bij Weeztix om de toegang veilig te autoriseren. Gebruik dit callbackadres in de Weeztix OAuth Client-instellingen:",oauthSaved:"Weeztix OAuth-verbinding succesvol aangemaakt.",oauthFailed:"Weeztix heeft de koppeling niet voltooid. Controleer de OAuth-instellingen en probeer opnieuw.",oauthExpiry:"Weeztix autorisatie verlopen. Start de koppeling opnieuw.",oauthDeclined:"Weeztix-toegang niet toegestaan.",oauthNotReady:"Vul eerst de Weeztix OAuth Client ID en Client Secret in en sla op."},
 fr:{title:"Gérer les identifiants en sécurité",intro:"Le responsable principal et Administration partagent les mêmes connexions. Les clés sont chiffrées et ne peuvent plus être consultées.",provider:"Service",configured:"Enregistré en sécurité",missing:"Non connecté",choose:"Choisir un service",save:"Enregistrer ou remplacer",remove:"Déconnecter",confirm:"Confirmer la déconnexion",cancel:"Annuler",busy:"Sécurisation…",saved:"Configuration enregistrée. Testez la connexion ci-dessous.",removed:"Connexion supprimée. L'ancienne clé a été effacée.",unavailable:"Stockage indisponible.",invalid:"Vérifiez les informations.",forbidden:"Autorisation insuffisante.",keyMissing:"Clé de chiffrement serveur manquante. Le créateur doit configurer UPT_INTEGRATION_ENCRYPTION_KEY dans Cloudflare.",last:"Dernière modification",warning:"Enregistrer n'active ni les paiements, ni Peppol, ni la synchronisation bancaire. Les jetons Weeztix exigent encore le renouvellement automatique.",auditTitle:"Historique des intégrations",auditEmpty:"Aucune modification enregistrée.",auditConnected:"Connecté",auditUpdated:"Modifié",auditDisconnected:"Déconnecté",auditBy:"par",oauthConnect:"Connecter Weeztix en sécurité",oauthHelp:"Enregistrez d'abord l'identifiant et le secret OAuth. Autorisez ensuite l'accès via Weeztix. Utilisez cette URL de rappel dans les paramètres OAuth Weeztix :",oauthSaved:"Connexion OAuth Weeztix établie.",oauthFailed:"La connexion Weeztix n'a pas abouti. Vérifiez les réglages OAuth.",oauthExpiry:"Autorisation Weeztix expirée. Recommencez.",oauthDeclined:"Accès Weeztix refusé.",oauthNotReady:"Enregistrez d'abord l'identifiant et le secret OAuth Weeztix."},
 en:{title:"Securely manage provider credentials",intro:"Head Admin and Administration share one set of connections. Keys are encrypted and cannot be read back after saving.",provider:"Provider",configured:"Stored securely",missing:"Not connected",choose:"Choose a provider",save:"Save or replace",remove:"Disconnect",confirm:"Confirm disconnect",cancel:"Cancel",busy:"Securing credentials…",saved:"Credentials saved securely. Test the connection below.",removed:"Connection removed and old secrets deleted.",unavailable:"Secure storage unavailable.",invalid:"Check the supplied credentials.",forbidden:"You are not permitted to change this connection.",keyMissing:"Server encryption key missing. Maker must configure UPT_INTEGRATION_ENCRYPTION_KEY as a Cloudflare secret.",last:"Last updated",warning:"Saving does not activate payments, Peppol delivery or banking synchronization. Weeztix access tokens still need automatic refresh.",auditTitle:"Integration change history",auditEmpty:"No changes recorded yet.",auditConnected:"Connected",auditUpdated:"Updated",auditDisconnected:"Disconnected",auditBy:"by",oauthConnect:"Connect Weeztix securely",oauthHelp:"Save the OAuth Client ID and Client Secret first. Then authorize access at Weeztix. Register this callback URL in your Weeztix OAuth Client settings:",oauthSaved:"Weeztix OAuth connection completed.",oauthFailed:"Weeztix connection could not be completed. Check the OAuth configuration and retry.",oauthExpiry:"Weeztix authorization expired. Start again.",oauthDeclined:"Weeztix access was not approved.",oauthNotReady:"Save the Weeztix OAuth Client ID and Client Secret first."},
 de:{title:"Providerzugänge sicher verwalten",intro:"Hauptadmin und Administration teilen dieselben Verbindungen. Schlüssel werden verschlüsselt und nach dem Speichern nicht wieder angezeigt.",provider:"Dienst",configured:"Sicher gespeichert",missing:"Nicht verbunden",choose:"Dienst auswählen",save:"Speichern oder ersetzen",remove:"Trennen",confirm:"Trennung bestätigen",cancel:"Abbrechen",busy:"Zugang wird gesichert…",saved:"Zugangsdaten sicher gespeichert. Verbindung unten prüfen.",removed:"Verbindung getrennt und alte Schlüssel gelöscht.",unavailable:"Sicherer Speicher nicht verfügbar.",invalid:"Zugangsdaten überprüfen.",forbidden:"Keine Berechtigung für diese Verbindung.",keyMissing:"Server-Verschlüsselungsschlüssel fehlt. Maker muss UPT_INTEGRATION_ENCRYPTION_KEY als Cloudflare-Secret setzen.",last:"Zuletzt geändert",warning:"Speichern aktiviert keine Zahlungen, Peppol-Versand oder Banksynchronisation. Weeztix-Token benötigen noch automatische Erneuerung.",auditTitle:"Änderungen an Integrationen",auditEmpty:"Noch keine Änderungen erfasst.",auditConnected:"Verbunden",auditUpdated:"Geändert",auditDisconnected:"Getrennt",auditBy:"durch",oauthConnect:"Weeztix sicher verbinden",oauthHelp:"Zuerst OAuth Client ID und Client Secret speichern. Dann den Zugriff bei Weeztix freigeben. Diese Rückruf-URL im Weeztix OAuth-Client hinterlegen:",oauthSaved:"Weeztix OAuth-Verbindung erfolgreich.",oauthFailed:"Weeztix-Verbindung konnte nicht abgeschlossen werden. OAuth-Einstellungen prüfen.",oauthExpiry:"Weeztix-Autorisierung abgelaufen. Erneut starten.",oauthDeclined:"Weeztix-Zugriff verweigert.",oauthNotReady:"Zuerst Weeztix OAuth Client ID und Client Secret speichern."}
} as const

type AuditEvent={provider:IntegrationProvider;action:"connected"|"updated"|"disconnected";actor_name:string;occurred_at:string}
type State={integrations:IntegrationSummary[];audit:AuditEvent[];secureStoreAvailable:boolean;weeztixOauthReady:boolean}
const endpoint="/api/administration/integrations"
const defaults:Record<string,string>={DOCUMENSO_BASE_URL:"https://app.documenso.com",WEEZTIX_SCANNING_ENABLED:"false"}
const errorCodes={general:"unavailable",invalid:"invalid",missingKey:"keyMissing",denied:"forbidden"} as const
function subscribeLocation(){return ()=>{}}
function readOAuthResult(){return new URLSearchParams(window.location.search).get("weeztix_oauth")}
function serverOAuthResult(){return null}

export function IntegrationCredentialManager({initialLocale}:{initialLocale:SupportedUiLocale}){
 const [locale,setLocale]=useState<SupportedUiLocale>(initialLocale)
 const [provider,setProvider]=useState<IntegrationProvider>("sumup")
 const [fields,setFields]=useState<Record<string,string>>({})
 const [state,setState]=useState<State|null>(null)
 const oauthResult=useSyncExternalStore(subscribeLocation,readOAuthResult,serverOAuthResult)
 const [busy,setBusy]=useState(false)
 const [confirm,setConfirm]=useState(false)
 const [notice,setNotice]=useState("")
 const [error,setError]=useState("")
 useEffect(()=>{const apply=()=>setLocale(activeUiLocale());apply();window.addEventListener(LANGUAGE_APPLIED_EVENT,apply);return()=>window.removeEventListener(LANGUAGE_APPLIED_EVENT,apply)},[])
 useEffect(()=>{
  const controller=new AbortController()
  fetch(endpoint,{cache:"no-store",signal:controller.signal}).then(async r=>{
   if(!r.ok)throw Error("error")
   const body:unknown=await r.json()
   if(!body||typeof body!=="object"||!("integrations" in body)||!Array.isArray(body.integrations))throw Error("error")
   if(!controller.signal.aborted)setState({integrations:body.integrations as IntegrationSummary[],audit:"audit" in body&&Array.isArray(body.audit)?body.audit as AuditEvent[]:[],secureStoreAvailable:"secureStoreAvailable" in body&&body.secureStoreAvailable===true,weeztixOauthReady:"weeztixOauthReady" in body&&body.weeztixOauthReady===true})
  }).catch(()=>{if(!controller.signal.aborted)setError("unavailable")})
  return()=>controller.abort()
 },[])
 async function refresh(){
  const response=await fetch(endpoint,{cache:"no-store"})
  if(!response.ok)throw Error("unavailable")
  const result:unknown=await response.json()
  if(!result||typeof result!=="object"||!("integrations" in result)||!Array.isArray(result.integrations))throw Error("unavailable")
  setState({integrations:result.integrations as IntegrationSummary[],audit:"audit" in result&&Array.isArray(result.audit)?result.audit as AuditEvent[]:[],secureStoreAvailable:"secureStoreAvailable" in result&&result.secureStoreAvailable===true,weeztixOauthReady:"weeztixOauthReady" in result&&result.weeztixOauthReady===true})
 }
 async function perform(method:"POST"|"DELETE"){
  if(busy)return
  setBusy(true);setError("");setNotice("")
  try{
   const body=method==="POST"?{provider,credentials:Object.fromEntries(integrationFields[provider].map(k=>[k,fields[k]??defaults[k]??""]))}:{provider}
   const response=await fetch(endpoint,{method,headers:{"Content-Type":"application/json"},credentials:"same-origin",cache:"no-store",body:JSON.stringify(body)})
   if(!response.ok){
    const detail:unknown=await response.json().catch(()=>null)
    const code=detail&&typeof detail==="object"&&"error" in detail?String(detail.error):"unavailable"
    setError(code==="invalid_credentials"?errorCodes.invalid:code==="integration_master_key_unavailable"?errorCodes.missingKey:response.status===403?errorCodes.denied:errorCodes.general)
    return
   }
   setFields({});setConfirm(false);setNotice(method==="POST"?"saved":"removed")
   await refresh()
  }catch{setError("unavailable")}finally{setBusy(false)}
 }
 const t=copy[locale],entries=state?.integrations??[]
 const oauthMessage=oauthResult==="connected"?t.oauthSaved:oauthResult==="expired"?t.oauthExpiry:oauthResult==="denied"?t.oauthDeclined:oauthResult==="failed"?t.oauthFailed:null
 const entry=entries.find(x=>x.provider===provider)
 const textOf=(code:string)=>({saved:t.saved,removed:t.removed,keyMissing:t.keyMissing,invalid:t.invalid,forbidden:t.forbidden} as Record<string,string>)[code]??t.unavailable
 return <section className="mt-4 space-y-3 rounded-xl border p-4" aria-label={t.title}>
  <h3 className="font-semibold">{t.title}</h3>
  <p className="text-xs text-muted-foreground">{t.intro}</p>
  <label className="block text-sm">{t.provider}
   <select className="mt-1 w-full min-h-11 rounded-lg border bg-background px-3" value={provider} disabled={busy} onChange={event=>{setProvider(event.target.value as IntegrationProvider);setFields({});setNotice("");setError("");setConfirm(false)}}>
    {integrationProviders.map(item=><option value={item} key={item}>{names[item]}</option>)}
   </select>
  </label>
  <p className="text-xs font-semibold">{entry?t.configured:t.missing}</p>
  {entry&&<p className="text-xs text-muted-foreground">{t.last}: {new Date(entry.updated_at).toLocaleString(locale)}</p>}
  {!state?.secureStoreAvailable&&<p className="text-xs text-amber-600" role="status">{t.keyMissing}</p>}
  <form className="space-y-3" autoComplete="off" onSubmit={e=>{e.preventDefault();void perform("POST")}}>
   {integrationFields[provider].map(key=>key==="WEEZTIX_SCANNING_ENABLED"?
    <label key={key} className="flex min-h-11 items-center gap-3 text-sm">
     <input type="checkbox" className="h-5 w-5" checked={(fields[key]??defaults[key])==="true"} disabled={busy} onChange={event=>setFields(old=>({...old,[key]:event.target.checked?"true":"false"}))}/>
     {labels[locale].WEEZTIX_SCANNING_ENABLED}
    </label>:
    <label key={key} className="block text-sm">{labels[locale][key as keyof typeof labels.nl]}
    <input type={key==="DOCUMENSO_BASE_URL"||key==="WEEZTIX_ACTIVE_EVENT_ID"||key==="SUMUP_MERCHANT_CODE"||key==="PONTO_CLIENT_ID"||key==="BILLIT_SANDBOX_PARTY_ID"||key==="WEEZTIX_CLIENT_ID"?"text":"password"} className="mt-1 w-full min-h-11 rounded-lg border bg-background px-3" required={provider!=="weeztix"||(key!=="WEEZTIX_ACCESS_TOKEN"&&key!=="WEEZTIX_CLIENT_ID"&&key!=="WEEZTIX_CLIENT_SECRET")} minLength={key==="WEEZTIX_ACCESS_TOKEN"||key==="WEEZTIX_CLIENT_ID"||key==="WEEZTIX_CLIENT_SECRET"?0:3} maxLength={4096} autoComplete="off" spellCheck={false} value={fields[key]??defaults[key]??""} onChange={e=>setFields(old=>({...old,[key]:e.target.value}))}/>
   </label>)}
   <div className="flex flex-wrap gap-2">
    <button type="submit" disabled={busy||!state?.secureStoreAvailable} className="min-h-11 rounded-lg bg-violet-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy?t.busy:t.save}</button>
    {entry&&!confirm&&<button type="button" disabled={busy} onClick={()=>setConfirm(true)} className="min-h-11 rounded-lg border px-4 py-2 font-semibold">{t.remove}</button>}
    {entry&&confirm&&<>
     <button type="button" disabled={busy} onClick={()=>void perform("DELETE")} className="min-h-11 rounded-lg border border-red-600 px-4 py-2 font-semibold text-red-600">{t.confirm}</button>
     <button type="button" disabled={busy} onClick={()=>setConfirm(false)} className="min-h-11 rounded-lg border px-4 py-2">{t.cancel}</button>
    </>}
   </div>
  </form>
  {provider==="weeztix"&&<section className="space-y-2 rounded-lg border p-3">
   <p className="text-xs text-muted-foreground">{t.oauthHelp}</p>
   <code className="block break-all rounded bg-muted p-2 text-[11px]">https://uptilldawn-main.uptilldawn.workers.dev/api/administration/integrations/weeztix/callback</code>
   {state?.weeztixOauthReady?
    <a className="inline-flex min-h-11 items-center rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white" href="/api/administration/integrations/weeztix/start">{t.oauthConnect}</a>:
    <p className="text-xs text-muted-foreground">{t.oauthNotReady}</p>}
   {oauthMessage&&<p role="status" className={oauthResult==="connected"?"text-sm text-green-600":"text-sm text-red-600"}>{oauthMessage}</p>}
  </section>}
  {notice&&<p role="status" className="text-sm text-green-600">{textOf(notice)}</p>}
  {error&&<p role="alert" className="text-sm text-red-600">{textOf(error)}</p>}
  <p className="text-xs text-muted-foreground">{t.warning}</p>
  <details className="rounded-lg border p-3">
   <summary className="cursor-pointer text-sm font-semibold">{t.auditTitle}</summary>
   {state?.audit.length?
    <ol className="mt-2 divide-y">
     {state.audit.map((row,index)=><li key={row.provider+row.occurred_at+index} className="py-2 text-xs">
      <strong>{names[row.provider]}</strong> · {row.action==="connected"?t.auditConnected:row.action==="updated"?t.auditUpdated:t.auditDisconnected}
      {" · "}{new Date(row.occurred_at).toLocaleString(locale)} · {t.auditBy} {row.actor_name}
     </li>)}
    </ol>:<p className="mt-2 text-xs text-muted-foreground">{t.auditEmpty}</p>}
  </details>

 </section>
}
