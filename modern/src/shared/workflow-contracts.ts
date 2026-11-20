// Pure validation boundaries shared by UI and transactional RPC clients.
// These functions have no DOM, Supabase, Cloudflare or auth dependencies and
// run in Node CI without mocks.
export type QrAction="outside_window"|"confirm_required"|"early_reason_required"|"contact"|"remote_required"|"pending"|"requested"
export type QrKind="shift"|"briefings"|"start"|"stop"
export type QrResult={
 action:QrAction;kind:QrKind|null;requestId:string|null;
 reviewer:string|null;nextStart:string|null;items:{id:string;title:string}[]
}
const actions=new Set<QrAction>(["outside_window","confirm_required","early_reason_required","contact","remote_required","pending","requested"])
const kinds=new Set<QrKind>(["shift","briefings","start","stop"])
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function assertUuid(value:string):string{
 if(typeof value!=="string"||!uuid.test(value))throw new Error("invalid_identifier")
 return value
}
const short=(value:unknown,max:number):string|null=>typeof value==="string"&&value.length<=max?value:null
export function parseQrResult(value:unknown):QrResult{
 if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("invalid_qr_response")
 const row=value as Record<string,unknown>
 if(!actions.has(row.action as QrAction))throw new Error("invalid_qr_response")
 const items=Array.isArray(row.items)?row.items.slice(0,40).flatMap((v:unknown)=>{
  if(!v||typeof v!=="object")return []
  const obj=v as Record<string,unknown>,id=short(obj.id,60),title=short(obj.title,300)
  return id&&title?[{id,title}]:[]
 }):[]
 return {
  action:row.action as QrAction,
  kind:kinds.has(row.kind as QrKind)?row.kind as QrKind:null,
  requestId:short(row.request_id,60),reviewer:short(row.reviewer,40),
  nextStart:short(row.next_start,55),items,
 }
}
export type IncidentInput={
 operationId:string;eventId:string;workplaceId?:string|null;
 message:string;category:string;urgency:string;peopleInvolved?:string;
 position?:{latitude:number;longitude:number;accuracy:number}|null
}
const categories=new Set(["general","medical","safety","security","equipment","technical","staff"])
const urgencyLevels=new Set(["normal","high","urgent"])
export function validIncident(input:IncidentInput){
 assertUuid(input.operationId);assertUuid(input.eventId)
 if(input.workplaceId)assertUuid(input.workplaceId)
 const message=input.message.trim(),people=(input.peopleInvolved||"").trim()
 if(message.length<3||message.length>4000)throw new Error("invalid_incident_description")
 if(people.length>2000)throw new Error("invalid_people_involved")
 if(!categories.has(input.category)||!urgencyLevels.has(input.urgency))throw new Error("invalid_incident_level")
 const location=input.position
 if(location){
  if(!Number.isFinite(location.latitude)||Math.abs(location.latitude)>90||
     !Number.isFinite(location.longitude)||Math.abs(location.longitude)>180||
     !Number.isFinite(location.accuracy)||location.accuracy<0||location.accuracy>10000)
   throw new Error("invalid_position")
 }
 return {
  event_id:input.eventId,
  ...(input.workplaceId?{workplace_id:input.workplaceId}:{}),
  message,category:input.category,urgency:input.urgency,
  ...(people?{people_involved:people}:{}),
  ...(location?{latitude:location.latitude,longitude:location.longitude,accuracy:location.accuracy}:{})
 }
}
export function normalizedReviewReason(approve:boolean,reason?:string):string|null{
 if(typeof approve!=="boolean")throw new Error("invalid_decision")
 const clean=(reason||"").trim()
 if(!approve&&(clean.length<3||clean.length>1000))throw new Error("reason_required")
 if(clean.length>1000)throw new Error("reason_too_long")
 return approve?null:clean
}
