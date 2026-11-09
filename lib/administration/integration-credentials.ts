/** Allowlist of provider secrets that may be configured by the approved Admin/Administration roles.
 * No provider can be enabled for payment, bank access or document dispatch by this form.
 */
export const integrationProviders=["sumup","documenso","banking","weeztix","peppol"] as const
export type IntegrationProvider=typeof integrationProviders[number]
export const integrationFields:Record<IntegrationProvider,readonly string[]>={
 sumup:["SUMUP_API_KEY","SUMUP_MERCHANT_CODE"],
 documenso:["DOCUMENSO_BASE_URL","DOCUMENSO_API_KEY"],
 banking:["PONTO_CLIENT_ID","PONTO_CLIENT_SECRET"],
 weeztix:["WEEZTIX_ACCESS_TOKEN","WEEZTIX_ACTIVE_EVENT_ID","WEEZTIX_SCANNING_ENABLED","WEEZTIX_CLIENT_ID","WEEZTIX_CLIENT_SECRET"],
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
 if(provider==="weeztix"){
  const base=["WEEZTIX_ACCESS_TOKEN","WEEZTIX_ACTIVE_EVENT_ID","WEEZTIX_SCANNING_ENABLED"]
  const client=["WEEZTIX_CLIENT_ID","WEEZTIX_CLIENT_SECRET"]
  const rotated=["WEEZTIX_REFRESH_TOKEN","WEEZTIX_TOKEN_EXPIRES_AT"]
  const allow=[...base,...client,...rotated]
  if(Object.keys(record).some(key=>!allow.includes(key))||!base.every(key=>key in record))return null
  if(client.some(key=>key in record)&&!client.every(key=>key in record))return null
  if(rotated.some(key=>key in record)&&!rotated.every(key=>key in record))return null
  const valid:Record<string,string>={}
  for(const [key,raw] of Object.entries(record)){
   if(typeof raw!=="string"||raw.trim()!==raw||raw.length>4096||/[\u0000-\u001f\u007f]/.test(raw))return null
   if(raw!==""&&raw.length<3)return null
   valid[key]=raw
  }
  if(!uuid.test(valid.WEEZTIX_ACTIVE_EVENT_ID))return null
  if(!["true","false"].includes(valid.WEEZTIX_SCANNING_ENABLED))return null
  const hasClient=client.every(key=>(valid[key]??"").length>=3)
  if(!hasClient&&client.some(key=>(valid[key]??"")!==""))return null
  if(!hasClient&&!valid.WEEZTIX_ACCESS_TOKEN)return null
  if(rotated.every(key=>key in record)){
   if(!hasClient||!valid.WEEZTIX_ACCESS_TOKEN||!valid.WEEZTIX_REFRESH_TOKEN||
      !/^[0-9]{10,13}$/.test(valid.WEEZTIX_TOKEN_EXPIRES_AT)||
      !Number.isSafeInteger(Number(valid.WEEZTIX_TOKEN_EXPIRES_AT)))return null
  }
  return valid
 }
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
 if(provider==="weeztix"&&(!uuid.test(valid.WEEZTIX_ACTIVE_EVENT_ID)||!["true","false"].includes(valid.WEEZTIX_SCANNING_ENABLED)))return null
 return valid
}
