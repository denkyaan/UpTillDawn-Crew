// Explicit deployment profiles; never select a database from a browser host,
// request header, OAuth value or user role. The existing public candidate
// remains the default. Standalone Main and Production are rehearsal-only
// until release approval; no active deployment declares either profile.
export const MAIN_ORIGIN="https://uptilldawn-main.uptilldawn.workers.dev"
export const CANDIDATE_ORIGIN="https://uptilldawn-modern-main.uptilldawn.workers.dev"
export const MAIN_QA_DATABASE="https://npbjrtiolqperdgljnhi.supabase.co"
export const PRODUCTION_ORIGIN="https://crew.uptilldawn.workers.dev"
export const PRODUCTION_DATABASE="https://eakoavcieossazqzplke.supabase.co"
export type RuntimeScope={requestOrigin:string;appOrigin:string;projectUrl:string;standalone:boolean}
export type RuntimeEnvironment={
 SUPABASE_URL:string;SUPABASE_ANON_KEY?:string;UPT_MIGRATION_RUNTIME_TARGET?:string;
 UPT_MIGRATION_NATIVE_AUTH_ENABLED?:string;MAIN_AUTH_RUNTIME?:unknown;MAIN_AUTH?:unknown
}
export function nativeRuntimeScope(env:RuntimeEnvironment):RuntimeScope|null{
 const target=env.UPT_MIGRATION_RUNTIME_TARGET
 if(target===undefined||target==="main-qa"){
  if(env.SUPABASE_URL!==MAIN_QA_DATABASE)return null
  return {requestOrigin:CANDIDATE_ORIGIN,appOrigin:MAIN_ORIGIN,projectUrl:MAIN_QA_DATABASE,standalone:false}
 }
 if(env.UPT_MIGRATION_NATIVE_AUTH_ENABLED!=="true"||env.MAIN_AUTH_RUNTIME||env.MAIN_AUTH)return null
 if(target==="main-standalone"&&env.SUPABASE_URL===MAIN_QA_DATABASE)
  return {requestOrigin:MAIN_ORIGIN,appOrigin:MAIN_ORIGIN,projectUrl:MAIN_QA_DATABASE,standalone:true}
 if(target==="production-standalone"&&env.SUPABASE_URL===PRODUCTION_DATABASE)
  return {requestOrigin:PRODUCTION_ORIGIN,appOrigin:PRODUCTION_ORIGIN,projectUrl:PRODUCTION_DATABASE,standalone:true}
 return null
}
export function runtimeForRequest(url:string,env:RuntimeEnvironment):RuntimeScope|null{
 const scope=nativeRuntimeScope(env)
 return scope&&new URL(url).origin===scope.requestOrigin?scope:null
}
export function isNativeAuthProject(appOrigin:string,projectUrl:string){
 return (appOrigin===MAIN_ORIGIN&&projectUrl===MAIN_QA_DATABASE)||
  (appOrigin===PRODUCTION_ORIGIN&&projectUrl===PRODUCTION_DATABASE)
}
