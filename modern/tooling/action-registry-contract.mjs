// Generated browser action stubs and the Main-only server registry must be
// in exact sync. This is transport integrity, NOT proof of functional parity.
export function verifyOriginalActionRegistry(sourceActions,registrySource){
 const ids=sourceActions.map(entry=>typeof entry==="string"?entry:entry?.id)
 const mapped=[...registrySource.matchAll(/^"([^"\n]+#[A-Za-z_$][\w$]*)":/gm)].map(match=>match[1])
 if(!ids.length||!mapped.length||ids.some(id=>typeof id!=="string"))
  throw Error("Original action discovery unavailable — fail closed")
 const source=new Set(ids),registry=new Set(mapped)
 if(source.size!==ids.length||registry.size!==mapped.length)
  throw Error("Duplicate original-action identifiers in source or server registry")
 const missing=ids.filter(id=>!registry.has(id))
 const obsolete=mapped.filter(id=>!source.has(id))
 if(missing.length||obsolete.length)
  throw Error("Original action transport drift: missing="+JSON.stringify(missing.slice(0,20))+
   " obsolete="+JSON.stringify(obsolete.slice(0,20))+
   " — regenerate the allowlist; do not claim 1:1 parity")
 return {sourceCount:ids.length,registeredCount:mapped.length}
}
