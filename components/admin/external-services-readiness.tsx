import {loadExternalServicesView} from "@/lib/administration/external-services-view-data"
import type {SupportedUiLocale} from "@/lib/locale-preferences"
import {integrationProviders,type IntegrationProvider} from "@/lib/administration/integration-credentials"
import {ProviderConnectionProbe} from "@/components/admin/provider-connection-probe"
import {externalServicesCopy,type IntegrationId,type IntegrationReadiness} from "@/lib/administration/external-services-readiness"

const copy={
 nl:{setup:"Koppeling instellen of wijzigen",manage:"Instellen",chooseEvent:"Selecteer het gekoppelde evenement in de beveiligde instellingen.",needProvider:"Vraag eerst de officiële aansluitgegevens bij de dienstverlener aan.",statusUnavailable:"Verbindingsstatus kan momenteel niet worden geladen. Probeer later opnieuw.",connect:"Verbinden met mijn account",choose:"Kies eerst je evenement",appPending:"UpTillDawn wacht op technische goedkeuring van deze koppeling. Je hoeft geen API-sleutels te bezorgen.",connectionNeedsProvider:"Deze dienst ondersteunt nog geen gevalideerde veilige accountaanmelding via UpTillDawn. De eindgebruiker hoeft geen sleutels in te vullen."},
 fr:{setup:"Configurer ou modifier la connexion",manage:"Configurer",chooseEvent:"Sélectionnez l'événement lié dans les paramètres sécurisés.",needProvider:"Demandez d'abord les accès officiels au fournisseur.",statusUnavailable:"Impossible de charger l’état des connexions. Réessayez plus tard.",connect:"Connecter mon compte",choose:"Choisissez votre événement",appPending:"UpTillDawn attend l’enregistrement technique auprès du fournisseur. Aucune clé API ne vous est demandée.",connectionNeedsProvider:"Ce fournisseur ne dispose pas encore d’une connexion de compte vérifiée. Aucune clé API à saisir."},
 en:{setup:"Configure or change connection",manage:"Configure",chooseEvent:"Choose the connected event in secure settings.",needProvider:"Obtain official integration access from the provider first.",statusUnavailable:"Connection status is temporarily unavailable. Please retry later.",connect:"Connect my account",choose:"Choose your event",appPending:"UpTillDawn is awaiting the provider app registration. You do not need to supply API keys.",connectionNeedsProvider:"A verified account-login integration is not yet available for this service. No customer API keys are required."},
 de:{setup:"Verbindung einrichten oder ändern",manage:"Einrichten",chooseEvent:"Wählen Sie das zugeordnete Event in den geschützten Einstellungen.",needProvider:"Fordern Sie zuerst die offiziellen Zugangsdaten beim Anbieter an.",statusUnavailable:"Verbindungsstatus momentan nicht verfügbar. Bitte später erneut versuchen.",connect:"Mein Konto verbinden",choose:"Ereignis auswählen",appPending:"UpTillDawn wartet auf die App-Zulassung des Dienstleisters. Sie müssen keine API-Schlüssel liefern.",connectionNeedsProvider:"Für diesen Anbieter ist noch keine verifizierte Kontoanmeldung verfügbar. Keine Kundenschlüssel erforderlich."}
} as const
const managed=(id:IntegrationId):id is IntegrationProvider=>integrationProviders.some(provider=>provider===id)
const oauthProvider=(id:IntegrationId):id is "sumup"|"peppol"=>id==="sumup"||id==="peppol"

/** A contextual connection panel mounted only on its owning workflow page.
 * All roles use the same encrypted store; no global duplicate setup directory.
 */
export async function ExternalServicesReadiness({locale,services}:{locale:SupportedUiLocale;services:readonly IntegrationReadiness[]}){
 if(!services.length)return null
 const {access,lookup,events,oauthStorageReady,weeztixReady,oauthReady}=await loadExternalServicesView(services)
 const configured=new Set<string>(lookup.rows.map(row=>row.provider))
 const t=externalServicesCopy[locale],labels=copy[locale]
 return <section aria-label={t.title} className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5">
  <h3 className="font-semibold">{t.title}</h3>
  {access.ok&&!lookup.available&&<p role="status" className="text-xs font-medium text-amber-600">{labels.statusUnavailable}</p>}
  <div className="grid gap-3">
   {services.map(service=><article key={service.id} data-integration-workspace={service.id} className="min-w-0 space-y-3 rounded-xl border p-3 sm:p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
     <strong className="text-sm">{t.names[service.id]}</strong>
     <span className="text-xs font-medium text-muted-foreground">
      {access.ok&&!lookup.available?labels.statusUnavailable:configured.has(service.id as IntegrationProvider)?t.states.credentials_present:t.states[service.state]}
     </span>
    </div>
    <p className="text-xs leading-5 text-muted-foreground">{t.instructions[service.id]}</p>
    {service.docsUrl&&<a href={service.docsUrl} rel="noopener noreferrer" target="_blank" className="inline-flex text-xs font-medium text-violet-400 underline">{t.link}</a>}
    {access.ok&&oauthProvider(service.id)&&
     (oauthReady[service.id]&&oauthStorageReady&&lookup.available?
      <a href={"/api/administration/integrations/oauth/"+service.id+"/start"} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white">{labels.connect}</a>:
      <p role="status" className="text-xs text-muted-foreground">{labels.appPending}</p>)}
    {access.ok&&service.id==="weeztix"&&
     (weeztixReady&&oauthStorageReady&&lookup.available&&!events?.error&&(events?.data?.length??0)>0?
      <form action="/api/administration/integrations/weeztix/start" method="GET" className="flex flex-wrap items-end gap-2">
       <label className="flex min-w-44 flex-1 flex-col gap-1 text-xs">{labels.choose}
        <select name="eventId" required className="min-h-11 rounded-lg border bg-background px-3 text-sm">
         <option value="">{labels.choose}</option>
         {events?.data?.map(event=><option key={event.id} value={event.id}>{event.name}</option>)}
        </select>
       </label>
       <button type="submit" className="min-h-11 rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white">{labels.connect}</button>
      </form>:
      <p role="status" className="text-xs text-muted-foreground">{labels.appPending}</p>)}
    {access.ok&&managed(service.id)&&!oauthProvider(service.id)&&service.id!=="weeztix"&&
     <p role="status" className="text-xs text-muted-foreground">{labels.connectionNeedsProvider}</p>}
    {access.ok&&(service.id==="sumup"||service.id==="documenso"||service.id==="banking"||service.id==="peppol")&&<ProviderConnectionProbe provider={service.id} initialLocale={locale}/>}
   </article>)}
  </div>
 </section>
}
