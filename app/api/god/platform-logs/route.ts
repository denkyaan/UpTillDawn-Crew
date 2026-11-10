import {z} from 'zod'
import {authorizeStudio,StudioError,studioFailure,studioResponse} from '@/lib/god-studio-server'
import {GOD_ENVIRONMENTS,currentGodEnvironment} from '@/lib/god-mode-environments'

const schema=z.object({
 environment:z.enum(['main','production']),
 limit:z.coerce.number().int().min(1).max(100).default(50),
})
type PlatformLog={timestamp:string;source:string;message:string}
const sources=new Set(['postgres_logs','edge_logs','auth_logs','postgrest_logs','realtime_logs','storage_logs','pgbouncer_logs','auth_audit_logs','function_edge_logs'])

export async function GET(request:Request){
 try{
  const {client,token}=await authorizeStudio(request)
  const input=schema.parse(Object.fromEntries(new URL(request.url).searchParams))
  const own=currentGodEnvironment(process.env.NEXT_PUBLIC_SUPABASE_URL)
  if(!own)throw new StudioError('De Maker-omgeving is niet herkend.',503)
  // Never forward an environment JWT to another Supabase project; only
  // the separately stored private Management API token can read platform logs.
  const {data:secret,error:secretError}=await client.rpc('upt_god_database_secret',{p_token:token})
  if(secretError||typeof secret!=='string'||!secret)
   throw new StudioError('Koppel een Supabase Management API-token met analytics:read onder Koppelingen om platformlogs te bekijken.',428)

  const now=new Date()
  const from=new Date(now.getTime()-60*60*1000)
  const statement='select timestamp,source,event_message from logs order by timestamp desc limit '+input.limit
  const query=new URLSearchParams({
   sql:statement,iso_timestamp_start:from.toISOString(),iso_timestamp_end:now.toISOString(),
  })
  const project=GOD_ENVIRONMENTS[input.environment].supabaseProject
  const response=await fetch('https://api.supabase.com/v1/projects/'+project+'/analytics/endpoints/logs?'+query,{
   method:'GET',headers:{Authorization:'Bearer '+secret},cache:'no-store',redirect:'manual',
   signal:AbortSignal.timeout(20000),
  })
  if(!response.ok){
   if(response.status===401||response.status===403)
    throw new StudioError('De Supabase Management API-token mist analytics:read of toegang tot dit project.',403)
   throw new StudioError('Supabase-platformlogs zijn momenteel niet beschikbaar ('+response.status+').',503)
  }
  const payload=await response.json() as {result?:unknown;error?:string}
  if(payload.error||!Array.isArray(payload.result))
   throw new StudioError('De platformlogzoekopdracht gaf geen geldige gegevens terug.',502)
  const logs:PlatformLog[]=payload.result.slice(0,input.limit).flatMap(value=>{
   if(!value||typeof value!=='object')return []
   const row=value as {timestamp?:unknown;source?:unknown;event_message?:unknown}
   if(typeof row.timestamp!=='string'||typeof row.source!=='string'||!sources.has(row.source))return []
   const message=typeof row.event_message==='string'?row.event_message.slice(0,1800):''
   return [{timestamp:row.timestamp,source:row.source,message}]
  })
  return studioResponse({environment:input.environment,source:'supabase-management',readOnly:true,windowMinutes:60,logs})
 }catch(error){
  if(error instanceof z.ZodError)return studioResponse({error:'Ongeldige platformlogaanvraag.'},400)
  return studioFailure(error)
 }
}
