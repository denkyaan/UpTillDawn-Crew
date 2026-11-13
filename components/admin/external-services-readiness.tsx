import type {SupportedUiLocale} from "@/lib/locale-preferences"
import {integrationManagementAccess} from "@/lib/administration/integration-management-access"
import {listIntegrationSummaries} from "@/lib/administration/integration-store"
import {integrationProviders,type IntegrationProvider} from "@/lib/administration/integration-credentials"
import {ProviderConnectionProbe} from "@/components/admin/provider-connection-probe"
import {IntegrationCredentialManager} from "@/components/admin/integration-credential-manager"
import {externalServicesCopy,type IntegrationId,type IntegrationReadiness} from "@/lib/administration/external-services-readiness"

const copy={
 nl:{setup:"Koppeling instellen of wijzigen",manage:"Instellen",chooseEvent:"Selecteer het gekoppelde evenement in de beveiligde instellingen.",needProvider:"Vraag eerst de officiële aansluitgegevens bij de dienstverlener aan."},
 fr:{setup:"Configurer ou modifier la connexion",manage:"Configurer",chooseEvent:"Sélectionnez l'événement lié dans les paramètres sécurisés.",needProvider:"Demandez d'abord les accès officiels au fournisseur."},
 en:{setup:"Configure or change connection",manage:"Configure",chooseEvent:"Choose the connected event in secure settings.",needProvider:"Obtain official integration access from the provider first."},
 de:{setup:"Verbindung einrichten oder ändern",manage:"Einrichten",chooseEvent:"Wählen Sie das zugeordnete Event in den geschützten Einstellungen.",needProvider:"Fordern Sie zuerst die offiziellen Zugangsdaten beim Anbieter an."}
} as const
const managed=(id:IntegrationId):id is IntegrationProvider=>integrationProviders.some(provider=>provider===id)

/** A contextual connection panel mounted only on its owning workflow page.
 * All roles use the same encrypted store; no global duplicate setup directory.
 */
export async function ExternalServicesReadiness({locale,services}:{locale:SupportedUiLocale;services:readonly IntegrationReadiness[]}){
 if(!services.length)return null
 const access=await integrationManagementAccess()
 const stored=access.ok?await listIntegrationSummaries(access.db).catch(()=>[]):[]
 const configured=new Set(stored.map(row=>row.provider))
 const events=access.ok&&services.some(service=>service.id==="weeztix")
  ?await access.db.from("events").select("id,name").order("start_at",{ascending:false}).limit(100)
  :null
 const t=externalServicesCopy[locale],labels=copy[locale]
 return <section aria-label={t.title} className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5">
  <h3 className="font-semibold">{t.title}</h3>
  <div className="grid gap-3">
   {services.map(service=><article key={service.id} data-integration-workspace={service.id} className="min-w-0 space-y-3 rounded-xl border p-3 sm:p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
     <strong className="text-sm">{t.names[service.id]}</strong>
     <span className="text-xs font-medium text-muted-foreground">
      {configured.has(service.id as IntegrationProvider)?t.states.credentials_present:t.states[service.state]}
     </span>
    </div>
    <p className="text-xs leading-5 text-muted-foreground">{t.instructions[service.id]}</p>
    {service.docsUrl&&<a href={service.docsUrl} rel="noopener noreferrer" target="_blank" className="inline-flex text-xs font-medium text-violet-400 underline">{t.link}</a>}
    {access.ok&&managed(service.id)&&<details className="rounded-lg border p-3">
     <summary className="cursor-pointer text-sm font-semibold text-violet-400">{labels.setup}</summary>
     {service.id==="weeztix"&&<p className="mt-2 text-xs text-muted-foreground">{labels.chooseEvent}</p>}
     <IntegrationCredentialManager initialLocale={locale} provider={service.id} events={service.id==="weeztix"&&!events?.error?events?.data??[]:[]}/>
    </details>}
    {access.ok&&(service.id==="sumup"||service.id==="documenso"||service.id==="banking")&&<ProviderConnectionProbe provider={service.id} initialLocale={locale}/>}
   </article>)}
  </div>
 </section>
}
