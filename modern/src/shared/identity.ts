export type OperationalRole="staff"|"responsible_lead"|"admin"
export type Portal="events"|"promotion"|"administration"
export type Assignment={portal:Portal;role:string;approved:boolean;revoked_at:string|null}
export type VerifiedIdentity={id:string;full_name:string|null;role:OperationalRole;effective_role:OperationalRole|null;approved:boolean;account_blocked:boolean;is_owner:boolean}
const allowed:Record<Portal,readonly string[]>={events:["event_staff","event_responsible","admin"],promotion:["promoter","admin"],administration:["administrative_staff","admin"]}
export const portals=["events","promotion","administration"] as const
export function parseIdentity(row:unknown):VerifiedIdentity|null{
 if(!row||typeof row!=="object")return null
 const p=row as Record<string,unknown>
 if(typeof p.id!=="string"||!/^[-a-f0-9]{36}$/i.test(p.id))return null
 if(p.role!=="staff"&&p.role!=="responsible_lead"&&p.role!=="admin")return null
 if(typeof p.approved!=="boolean"||typeof p.account_blocked!=="boolean"||typeof p.is_owner!=="boolean")return null
 const role=p.effective_role==="staff"||p.effective_role==="responsible_lead"||p.effective_role==="admin"?p.effective_role:null
 return {id:p.id,full_name:typeof p.full_name==="string"?p.full_name:null,role:p.role, effective_role:role,approved:p.approved,account_blocked:p.account_blocked,is_owner:p.is_owner}
}
export function isActive(identity:VerifiedIdentity){return identity.is_owner||identity.approved&&!identity.account_blocked}
export function visiblePortals(identity:VerifiedIdentity,assignments:readonly Assignment[]):Portal[]{
 if(!isActive(identity))return []
 return portals.filter(portal=>identity.is_owner||identity.role==="admin"||
  (portal==="events"&&(identity.role==="staff"||identity.role==="responsible_lead"))||
  assignments.some(a=>a.portal===portal&&a.approved&&a.revoked_at===null&&allowed[portal].includes(a.role)))
}
export function safeRoute(value:string){return value.startsWith("/")&&!value.startsWith("//")&&!value.includes("\\")&&!/[\x00-\x1f]/.test(value)&&!value.split("/").includes("..")?value:"/"}
