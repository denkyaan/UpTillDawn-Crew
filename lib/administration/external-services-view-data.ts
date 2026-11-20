import 'server-only'
import {integrationManagementAccess} from './integration-management-access'
import {listIntegrationSummaries} from './integration-store'
import {userOAuthReady} from './provider-user-oauth'
import {validIntegrationMasterKey} from './integration-crypto'
import type {IntegrationReadiness} from './external-services-readiness'

/** Public view data only. No DB clients, keys, tokens or ciphertext. */
export async function loadExternalServicesView(services:readonly IntegrationReadiness[]){
 const access=await integrationManagementAccess()
 const lookup=access.ok
  ?await listIntegrationSummaries(access.db).then(rows=>({available:true as const,rows:rows.map(row=>({provider:row.provider}))})).catch(()=>({available:false as const,rows:[]}))
  :{available:false as const,rows:[]}
 const events=access.ok&&services.some(service=>service.id==='weeztix')
  ?await access.db.from('events').select('id,name').order('start_at',{ascending:false}).limit(100)
  :null
 return {
  access:{ok:access.ok},lookup,
  events:events?{data:events.data,error:events.error?true:null}:null,
  oauthStorageReady:access.ok&&validIntegrationMasterKey(process.env.UPT_INTEGRATION_ENCRYPTION_KEY),
  weeztixReady:access.ok&&Boolean(process.env.UPT_WEEZTIX_OAUTH_CLIENT_ID&&process.env.UPT_WEEZTIX_OAUTH_CLIENT_SECRET),
  oauthReady:{sumup:access.ok&&userOAuthReady('sumup'),peppol:access.ok&&userOAuthReady('peppol')},
 }
}
