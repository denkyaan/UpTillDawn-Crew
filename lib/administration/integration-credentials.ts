/** Allowlist of provider secrets that may be configured by the approved Admin/Administration roles.
 * No provider can be enabled for payment, bank access or document dispatch by this form.
 */
export const integrationProviders=["sumup","documenso","banking","weeztix","peppol"] as const
export type IntegrationProvider=typeof integrationProviders[number]
export const integrationFields:Record<IntegrationProvider,readonly string[]>={
 sumup:["SUMUP_API_KEY","SUMUP_MERCHANT_CODE"],
 documenso:["DOCUMENSO_BASE_URL","DOCUMENSO_API_KEY"],
 banking:["PONTO_CLIENT_ID","PONTO_CLIENT_SECRET"],
 weeztix:["WEEZTIX_ACCESS_TOKEN","WEEZTIX_ACTIVE_EVENT_ID"],
 peppol:["BILLIT_SANDBOX_PARTY_ID","BILLIT_SANDBOX_API_KEY"]
}
export type IntegrationConfiguration=Partial<Record<string,string>>
export type IntegrationSummary={provider:IntegrationProvider;updated_at:string;updated_by:string|null}
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i
export function isIntegrationProvider(value:unknown):value is IntegrationProvider{
 return typeof value==="string"&&(integrationProviders as readonly string[]).includes(value)
}
export function parseIntegrationConfiguration(provider:IntegrationProvider,input:unknown):IntegrationConfiguration|null{
 if(!input||typeof input!=="object"||Array.isArray(input))return null
 const record=input as Record<string,unknown>
 const fields=integrationFields[provider]
 if(Object.keys(record).length!==fields.length||Object.keys(record).some(k=>!fields.includes(k)))return null
 const valid:Record<string,string>={}
 for(const field of fields){
  const value=record[field]
  if(typeof value!=="string"||value.trim()!==value||value.length<3||value.length>4096||/[\u0000-\u001f\u007f]/.test(value))return null
  valid[field]=value
 }
 if(provider==="documenso"){
  // Do not let a browser-controlled URL turn this into an SSRF proxy.
  if(valid.DOCUMENSO_BASE_URL!=="https://app.documenso.com")return null
 }
 if(provider==="weeztix"&&!uuid.test(valid.WEEZTIX_ACTIVE_EVENT_ID))return null
 return valid
}
