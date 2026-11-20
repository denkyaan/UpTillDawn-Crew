import {z} from 'zod'
import {authorizeStudio,StudioError,studioFailure,studioResponse} from '@/lib/god-studio-server'
import {GOD_ENVIRONMENTS,currentGodEnvironment} from '@/lib/god-mode-environments'

type Target='main'|'production'
type Snapshot={errors:unknown[];recovery:unknown[];audit:unknown[]}
const schema=z.object({
 limit:z.coerce.number().int().min(1).max(100).default(50),
 environment:z.enum(['main','production']).optional(),
})

async function queryManagement(credential:string,project:string,query:string):Promise<unknown[]>{
 const response=await fetch('https://api.supabase.com/v1/projects/'+project+'/database/query',{
  method:'POST',
  headers:{'Authorization':'Bearer '+credential,'Content-Type':'application/json'},
  body:JSON.stringify({query,read_only:true}),
  cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(20000),
 })
 if(!response.ok)throw new StudioError('De geselecteerde omgeving kan haar logs niet delen. Controleer de Supabase Management-koppeling.',503)
 const payload:unknown=await response.json()
 if(!Array.isArray(payload))throw new StudioError('De externe logs hebben een onverwacht formaat.',502)
 return payload.slice(0,100)
}

export async function GET(request:Request){
 try{
  const {client,token}=await authorizeStudio(request)
  const {limit,environment}=schema.parse(Object.fromEntries(new URL(request.url).searchParams))
  const own=currentGodEnvironment(process.env.NEXT_PUBLIC_SUPABASE_URL)
  if(!own)throw new StudioError('Onbekende God Mode-omgeving.',503)
  const target:Target=environment||own
  if(target===own){
   const {data,error}=await client.rpc('upt_god_maker_log_snapshot',{p_token:token,p_limit:limit})
   if(error)throw new StudioError('De logfunctie van deze omgeving is nog niet beschikbaar.',503)
   if(!data||typeof data!=='object')throw new StudioError('Onvolledige logregistratie.',503)
   return studioResponse({logs:data,environment:target,source:'authenticated environment'})
  }
  // Cross-environment diagnostics require the Maker's existing private
  // Supabase Management connection. NEVER reuse the current project's JWT.
  const {data:secret,error:secretError}=await client.rpc('upt_god_database_secret',{p_token:token})
  if(secretError||typeof secret!=='string'||!secret)
   throw new StudioError('Koppel een Supabase Management-sleutel met leestoegang tot de andere omgeving.',428)
  const project=GOD_ENVIRONMENTS[target].supabaseProject
  const queries=[
   'select id,error_name,error_message,route,status,ai_severity,maker_action_required,reported_count,created_at,updated_at from public.user_error_reports order by created_at desc limit '+limit,
   'select id,check_type,status,checked_at from public.recovery_checks order by checked_at desc limit '+limit,
   'select id,action,entity_type,created_at from public.upt_audit_logs order by created_at desc limit '+limit,
  ]
  const [errors,recovery,audit]=await Promise.all(queries.map(query=>queryManagement(secret,project,query)))
  const logs:Snapshot={errors,recovery,audit}
  return studioResponse({logs,environment:target,source:'management read-only'})
 }catch(error){
  if(error instanceof z.ZodError)return studioResponse({error:'Ongeldige logaanvraag.'},400)
  return studioFailure(error)
 }
}
