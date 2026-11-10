import {z} from 'zod'
import {authorizeStudio,studioBody,studioFailure,studioResponse,StudioError} from '@/lib/god-studio-server'

const PROJECTS={
 main:'npbjrtiolqperdgljnhi',
 production:'eakoavcieossazqzplke',
} as const
const MAIN_URL='https://npbjrtiolqperdgljnhi.supabase.co'
const environment=z.enum(['main','production'])
function requireMainTest(){
 if(process.env.NEXT_PUBLIC_SUPABASE_URL!==MAIN_URL)
  throw new StudioError('God Mode SQL is uitsluitend beschikbaar vanuit het beveiligde main-testcontrolecentrum.',403)
}
async function queryDatabase(credential:string,query:string,readOnly:boolean,target:keyof typeof PROJECTS){
 const response=await fetch(`https://api.supabase.com/v1/projects/${PROJECTS[target]}/database/query`,{
  method:'POST',
  headers:{Authorization:`Bearer ${credential}`,'Content-Type':'application/json'},
  body:JSON.stringify({query,read_only:readOnly}),cache:'no-store',redirect:'manual',
  signal:AbortSignal.timeout(30000),
 })
 const data=await response.json().catch(()=>null)
 if(!response.ok)throw new StudioError(response.status===401||response.status===403
  ?'De Supabase-beheersleutel heeft geen toegang tot de gekozen database.'
  :`SQL mislukt: ${String(data?.message||data?.error||response.status).slice(0,1500)}`,400)
 return data as unknown
}
export async function GET(request:Request){
 try{
  requireMainTest()
  const {client,token}=await authorizeStudio(request)
  const {data,error}=await client.rpc('upt_god_database_secret',{p_token:token})
  if(error)throw new StudioError('Databasekoppeling niet beschikbaar.',503)
  return studioResponse({connected:Boolean(data),environments:['main','production'],defaultEnvironment:'main'})
 }catch(error){return studioFailure(error)}
}
export async function POST(request:Request){
 try{
  requireMainTest()
  const {client,token}=await authorizeStudio(request)
  const body=z.discriminatedUnion('action',[
   z.object({action:z.literal('connect'),credential:z.string().trim().min(20).max(500)}).strict(),
   z.object({action:z.literal('query'),query:z.string().trim().min(1).max(100000),write:z.boolean(),environment:environment.default('main')}).strict(),
   z.object({action:z.literal('disconnect')}).strict(),
  ]).parse(await studioBody(request))
  if(body.action==='connect'){
   await queryDatabase(body.credential,'select current_database() as database',true,'main')
   const {error}=await client.rpc('upt_god_database_connect',{p_token:token,p_secret:body.credential})
   if(error)throw new StudioError('Koppeling opslaan mislukt.',503)
   return studioResponse({ok:true})
  }
  if(body.action==='disconnect'){
   const {error}=await client.rpc('upt_god_database_disconnect',{p_token:token})
   if(error)throw new StudioError('Ontkoppelen mislukt.',503)
   return studioResponse({ok:true})
  }
  if(body.environment==='production'&&body.write){
   throw new StudioError('Productie-SQL is alleen-lezen. Gegevens- en structuurwijzigingen vereisen een afzonderlijke geteste release en expliciete productiegoedkeuring.',403)
  }
  const {data:credential,error}=await client.rpc('upt_god_database_secret',{p_token:token})
  if(error||!credential)throw new StudioError('Koppel een Supabase Management API-token onder Koppelingen.',428)
  return studioResponse({
   environment:body.environment,
   data:await queryDatabase(credential,body.query,!body.write,body.environment),
  })
 }catch(error){
  if(error instanceof z.ZodError)return studioResponse({error:'Ongeldige SQL-aanvraag.'},400)
  return studioFailure(error)
 }
}
