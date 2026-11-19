import type {OperationalRole,Portal} from "./identity"

// Only a user-scoped ROUTE is stored. Never persist JWTs, private screen data,
// profile fields or role claims. A stored path is a preference, not authority.
export type PortalAccess={
 userId:string;role:OperationalRole;isOwner:boolean;portals:readonly Portal[]
}
const KEY_PREFIX="uptilldawn-modern-portal:"
const allowedPaths=new Set([
 "/overview","/events","/tasks","/chat","/crew","/briefings","/qr",
 "/operations","/notifications","/profile","/responsible",
 "/portals/promotion","/portals/administration",
 "/portals/administration/finance","/maker/diagnostics",
])
export function canRememberRoute(path:string,access:PortalAccess):boolean{
 if(!allowedPaths.has(path))return false
 if(path==="/maker/diagnostics")return access.isOwner
 if(path==="/portals/administration"||path==="/portals/administration/finance")
  return access.portals.includes("administration")
 if(path==="/portals/promotion")return access.portals.includes("promotion")
 if(path==="/responsible")
  return access.isOwner||access.role==="admin"||access.role==="responsible_lead"
 if(["/events","/tasks","/chat","/crew","/briefings","/qr","/operations"].includes(path))
  return access.portals.includes("events")
 return true
}
// Invalid, stale or revoked preferences NEVER navigate to privileged routes.
// For an owner without a valid preference, require an explicit mode choice.
export function resolvePortalPreference(raw:string|null,access:PortalAccess):string|null{
 if(raw!==null&&canRememberRoute(raw,access))return raw
 return access.isOwner?null:"/overview"
}
const key=(uid:string)=>KEY_PREFIX+uid
export function preferredPortalRoute(access:PortalAccess):string|null{
 try{return resolvePortalPreference(localStorage.getItem(key(access.userId)),access)}
 catch{return access.isOwner?null:"/overview"}
}
export function rememberPortalRoute(path:string,access:PortalAccess):void{
 if(!canRememberRoute(path,access))return
 try{localStorage.setItem(key(access.userId),path)}catch{}
}
