/** Pure validation for Eventix and SumUp event mapping. No provider credentials are stored here. */
export type Provider='eventix'|'sumup'
export type ProviderEventMapping={provider:Provider;externalEventId:string;eventId:string;enabled:boolean}
export type MappingResult={mappings:ProviderEventMapping[];errors:string[]}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const external=/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,159}$/
/** Reject ambiguous mappings; never guess an internal event from a name or date. */
export function validateProviderEventMappings(input:readonly ProviderEventMapping[]):MappingResult{
 const mappings:ProviderEventMapping[]=[],errors:string[]=[]
 const seen=new Map<string,string>()
 for(let i=0;i<input.length;i++){
  const m=input[i]
  if(!m||!['eventix','sumup'].includes(m.provider)||typeof m.externalEventId!=='string'||!external.test(m.externalEventId)||typeof m.eventId!=='string'||!uuid.test(m.eventId)||typeof m.enabled!=='boolean'){
   errors.push('Invalid provider event mapping at row '+(i+1));continue
  }
  const key=m.provider+':'+m.externalEventId
  if(seen.has(key)){
   errors.push('Duplicate provider event mapping at row '+(i+1));continue
  }
  seen.set(key,m.eventId)
  mappings.push({...m})
 }
 return {mappings:errors.length?[]:mappings,errors}
}
/** Unmapped or disabled external events must never be silently imported. */
export function resolveProviderEvent(provider:Provider,externalEventId:string,mappings:readonly ProviderEventMapping[]):string|null{
 const matches=mappings.filter(m=>m.enabled&&m.provider===provider&&m.externalEventId===externalEventId)
 return matches.length===1?matches[0].eventId:null
}
