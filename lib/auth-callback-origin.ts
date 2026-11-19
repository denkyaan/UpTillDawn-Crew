const MAIN='https://uptilldawn-main.uptilldawn.workers.dev'
const CANDIDATE='https://uptilldawn-modern-main.uptilldawn.workers.dev'
const QA='https://npbjrtiolqperdgljnhi.supabase.co'

// Preserve the configured origin by default. The only optional alternate is
// the isolated Main candidate, using the SAME QA database. Never allow a
// browser-chosen external callback or a Production-to-QA recovery redirect.
export function authCallbackOrigin(appUrl:string|undefined,databaseUrl:string|undefined,requested:unknown):string|null{
 let origin:string
 try{const url=new URL(appUrl||'');if(!['http:','https:'].includes(url.protocol))return null;origin=url.origin}
 catch{return null}
 return origin===MAIN&&databaseUrl===QA&&requested===CANDIDATE?CANDIDATE:origin
}
