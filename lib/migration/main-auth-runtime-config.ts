// Only the trusted Main service binding can call the named Worker entrypoint.
// Never return DB administration keys, deployment keys or provider credentials.
export const MAIN_AUTH_PRIVATE_ENV_KEYS=Object.freeze([
 'RESEND_API_KEY','SECURITY_ALERT_EMAIL','SECURITY_FROM_EMAIL','GEOAPIFY_API_KEY',
 'UPT_MIGRATION_EMAIL_CALLBACK_READY',
] as const)
export const MAIN_QA_PROJECT='https://npbjrtiolqperdgljnhi.supabase.co'
export function mainAuthRuntimeConfiguration(env:Record<string,unknown>){
 if(typeof env.NEXT_PUBLIC_SUPABASE_URL==='string'&&env.NEXT_PUBLIC_SUPABASE_URL!==MAIN_QA_PROJECT)throw Error('Main QA configuration required')
 const values:Record<string,string>={}
 for(const name of MAIN_AUTH_PRIVATE_ENV_KEYS){const value=env[name];if(typeof value==='string')values[name]=value}
 return {protocol:'main-auth-native-v1',projectUrl:MAIN_QA_PROJECT,values}
}

 // Narrow provider-specific RPC: address lookup does not need mail keys.
export function mainGeoapifyRuntimeConfiguration(env:Record<string,unknown>){
 if(env.NEXT_PUBLIC_SUPABASE_URL!==MAIN_QA_PROJECT)throw Error('Main QA configuration required')
 return {protocol:'main-geoapify-native-v1',projectUrl:MAIN_QA_PROJECT,
  key:typeof env.GEOAPIFY_API_KEY==='string'?env.GEOAPIFY_API_KEY.trim():''}
}
