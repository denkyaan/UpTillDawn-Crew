import {z} from 'zod'
import {authorizeStudio,StudioError,studioFailure,studioResponse} from '@/lib/god-studio-server'

const schema=z.object({limit:z.coerce.number().int().min(1).max(100).default(50)})
const allowedMain='https://npbjrtiolqperdgljnhi.supabase.co'
export async function GET(request:Request){
 try{
  const {client,token}=await authorizeStudio(request)
  const params=new URL(request.url).searchParams
  const {limit}=schema.parse({limit:params.get('limit')||50})
  const environment=params.get('environment')==='production'?'production':'main'
  if(environment==='main'){
   const {data,error}=await client.rpc('upt_god_maker_log_snapshot',{p_token:token,p_limit:limit})
   if(error)throw new StudioError('Het Maker-logoverzicht is niet geïnstalleerd. Controleer de main-testmigraties.',503)
   return studioResponse({environment,logs:data,source:'main-test database'})
  }
  if(process.env.NEXT_PUBLIC_SUPABASE_URL!==allowedMain)
   throw new StudioError('Productiediagnostiek is alleen beschikbaar vanuit het beveiligde main-testcontrolecentrum.',403)
  const {data:credential,error}=await client.rpc('upt_god_database_secret',{p_token:token})
  if(error||!credential)throw new StudioError('Koppel een Supabase Management API-token om productielogs te kunnen bekijken.',428)
  const query=`select
   (select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc),'[]'::jsonb)
    from (select id,action,entity_type,created_at from public.upt_audit_logs order by created_at desc limit ${limit}) a) as audit,
   (select coalesce(jsonb_agg(to_jsonb(r) order by r.checked_at desc),'[]'::jsonb)
    from (select id,check_type,status,checked_at from public.recovery_checks order by checked_at desc limit ${limit}) r) as recovery,
   (select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc),'[]'::jsonb)
    from (select id,error_name,left(error_message,900) as error_message,route,status,
      ai_severity,maker_action_required,reported_count,created_at,updated_at
      from public.user_error_reports order by created_at desc limit ${limit}) e) as errors`
  const response=await fetch('https://api.supabase.com/v1/projects/eakoavcieossazqzplke/database/query',{
   method:'POST',
   headers:{Authorization:'Bearer '+credential,'Content-Type':'application/json'},
   body:JSON.stringify({query,read_only:true}),
   cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(25000),
  })
  if(!response.ok)throw new StudioError('De productielogs konden niet worden gelezen. Controleer de projectrechten van je Supabase-token.',503)
  const data=await response.json() as unknown
  if(!Array.isArray(data)||!data[0]||typeof data[0]!=='object')
   throw new StudioError('De Supabase-logrespons was ongeldig.',502)
  const logs=data[0] as Record<string,unknown>
  if(!Array.isArray(logs.errors)||!Array.isArray(logs.audit)||!Array.isArray(logs.recovery))
   throw new StudioError('De vereiste productielogtabellen zijn niet beschikbaar.',503)
  return studioResponse({environment,logs:{errors:logs.errors,audit:logs.audit,recovery:logs.recovery},source:'production database'})
 }catch(error){
  if(error instanceof z.ZodError)return studioResponse({error:'Ongeldige logaanvraag.'},400)
  return studioFailure(error)
 }
}
