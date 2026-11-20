// Server-only allowlist; logs are untrusted even when returned by privileged
// DB functions. Never put query strings, route identifiers, hostnames, secrets
// or raw database error payloads in the maker browser response.
const uuid=/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/gi
export function sanitizedMakerRoute(value:unknown):string|null{
 if(typeof value!=="string"||value.length>512)return null
 const route=value.split(/[?#]/,1)[0]
 if(route.startsWith("//")||!/^\/[A-Za-z0-9/_:.-]*$/.test(route))return null
 return route.replace(uuid,":id")
  .replace(/\/[0-9]{5,}(?=\/|$)/g,"/:id")
  .replace(/\/[A-Za-z0-9_-]{20,}(?=\/|$)/g,"/:redacted")
  .slice(0,120)
}
export function sanitizedMakerName(value:unknown):string|null{
 if(typeof value!=="string"||value.length<1||value.length>120)return null
 if(/bearer|secret|token|password|credential|authorization|api[_ -]?key|private[_ -]?key/i.test(value))
  return "Redacted error"
 if(!/^[A-Za-z0-9 _.:/-]+$/.test(value))return "Redacted error"
 return value.slice(0,80)
}
export function sanitizedMakerSeverity(value:unknown):string|null{
 if(typeof value!=="string")return null
 const code=value.trim().toLowerCase()
 return ["info","low","medium","warning","high","critical","error"].includes(code)?code:null
}
