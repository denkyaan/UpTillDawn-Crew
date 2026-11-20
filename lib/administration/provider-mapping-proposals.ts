import {validateProviderEventMappings,type Provider,type ProviderEventMapping} from './provider-event-mapping.ts'

/** Side-effect-free, fail-closed proposal engine. Never enables or writes a mapping. */
export type ProviderEventCandidate={provider:Provider;externalEventId:string;internalEventId:string;source:'verified-provider-id'|'name-match'|'manual';evidenceId:string}
export type MappingProposal={provider:Provider;externalEventId:string;eventId:string;enabled:false;evidenceId:string}
export type ProposalDecision={proposals:MappingProposal[];review:string[]}
export function proposeProviderEventMappings(candidates:readonly ProviderEventCandidate[],existing:readonly ProviderEventMapping[],knownEventIds:ReadonlySet<string>):ProposalDecision{
 const proposals:MappingProposal[]=[],review:string[]=[]
 const byExternal=new Map<string,ProviderEventCandidate[]>()
 for(const candidate of candidates){
  const key=JSON.stringify([candidate.provider,candidate.externalEventId])
  const group=byExternal.get(key)??[]
  group.push(candidate);byExternal.set(key,group)
 }
 for(const [key,group] of byExternal){
  const first=group[0]
  if(group.length!==1||first.source!=='verified-provider-id'||typeof first.evidenceId!=='string'||!first.evidenceId.trim()||first.evidenceId.length>512||!knownEventIds.has(first.internalEventId)){
   review.push(key);continue
  }
  const check=validateProviderEventMappings([{provider:first.provider,externalEventId:first.externalEventId,eventId:first.internalEventId,enabled:false}])
  if(check.errors.length){review.push(key);continue}
  const prior=existing.filter(m=>m.provider===first.provider&&m.externalEventId===first.externalEventId)
  if(prior.length){review.push(key);continue}
  proposals.push({...check.mappings[0],enabled:false,evidenceId:first.evidenceId})
 }
 return {proposals,review}
}
