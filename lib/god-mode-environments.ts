/**
 * Distinct Supabase Auth and data planes.
 * A Maker session/JWT from one project never authenticates to the other.
 * Switching environments is a full navigation to the target's own God Mode.
 */
export const GOD_ENVIRONMENTS={
 main:{
  id:'main' as const,
  label:'Main · test',
  origin:'https://uptilldawn-main.uptilldawn.workers.dev',
  supabaseUrl:'https://npbjrtiolqperdgljnhi.supabase.co',
  supabaseProject:'npbjrtiolqperdgljnhi',
  workflow:'deploy-main.yml',
  ciWorkflow:'fast-change-validation.yml',
 },
 production:{
  id:'production' as const,
  label:'Production · live',
  origin:'https://crew.uptilldawn.workers.dev',
  supabaseUrl:'https://eakoavcieossazqzplke.supabase.co',
  supabaseProject:'eakoavcieossazqzplke',
  workflow:'deploy-cloudflare.yml',
  ciWorkflow:'ci.yml',
 },
} as const

export type GodEnvironment=keyof typeof GOD_ENVIRONMENTS

export function currentGodEnvironment(url:string|undefined):GodEnvironment|null{
 // The disposable local Supabase stack can exercise the real God Mode owner
 // journey during CI. Never recognize a remote, arbitrary or production DB as
 // a test environment, and never enable this alias outside the E2E bridge.
 if(url==='http://127.0.0.1:54321'&&
    process.env.UPT_E2E_SESSION_BRIDGE==='1'&&
    process.env.NEXT_PUBLIC_APP_URL==='http://127.0.0.1:3000')return 'main'
 if(url===GOD_ENVIRONMENTS.main.supabaseUrl)return 'main'
 if(url===GOD_ENVIRONMENTS.production.supabaseUrl)return 'production'
 return null
}
export function requiredGodEnvironment(url:string|undefined){
 const environment=currentGodEnvironment(url)
 if(!environment)throw Error('God Mode is not configured for a recognized environment.')
 return GOD_ENVIRONMENTS[environment]
}
