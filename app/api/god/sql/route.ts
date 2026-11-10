import {z} from 'zod'
import {authorizeStudio,studioBody,studioFailure,studioResponse,StudioError} from '@/lib/god-studio-server'
import {GOD_ENVIRONMENTS,requiredGodEnvironment} from '@/lib/god-mode-environments'

const environment=z.enum(['main','production'])
type Target=z.infer<typeof environment>
async function queryDatabase(credential:string,query:string,readOnly:boolean,target:Target){
 const project=GOD_ENVIRONMENTS[target].supabaseProject
 const response=await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`,{
  method:'POST',headers:{Authorization:`Bearer ${credential}`,'Content-Type':'application/json'},
  body:JSON.stringify({query,read_only:readOnly}),cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(30000),
 })
 const data=await response.json().catch(()=>null)
 if(!response.ok)throw new StudioError(response.status===401||response.status===403
  ?'De Supabase-beheersleutel heeft geen databasebevoegdheid in deze omgeving.'
  :`SQL mislukt: ${String(data?.message||data?.error||response.status).slice(0,1200)}`,400)
 return data as unknown
}
export async function GET(request:Request){
 try{
  const project=requiredGodEnvironment(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const {client,token}=await authorizeStudio(request)
  const {data,error}=await client.rpc('upt_god_database_secret',{p_token:token})
  if(error)throw new StudioError('Databasekoppeling niet beschikbaar.',503)
  return studioResponse({connected:Boolean(data),environment:project.id,environments:['main','production']})
 }catch(error){return studioFailure(error)}
}
export async function POST(request:Request){
 try{
  const project=requiredGodEnvironment(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const {client,token}=await authorizeStudio(request)
  const body=z.discriminatedUnion('action',[
   z.object({action:z.literal('connect'),credential:z.string().trim().min(20).max(500)}).strict(),
   z.object({action:z.literal('query'),query:z.string().trim().min(1).max(100000),
    write:z.boolean(),environment:environment.optional(),productionConfirmation:z.string().optional()}).strict(),
   z.object({action:z.literal('disconnect')}).strict(),
  ]).parse(await studioBody(request))
  if(body.action==='connect'){
   await queryDatabase(body.credential,'select current_database() as database',true,project.id)
   const {error}=await client.rpc('upt_god_database_connect',{p_token:token,p_secret:body.credential})
   if(error)throw new StudioError('Koppeling opslaan mislukt.',503)
   return studioResponse({ok:true,environment:project.id})
  }
  if(body.action==='disconnect'){
   const {error}=await client.rpc('upt_god_database_disconnect',{p_token:token})
   if(error)throw new StudioError('Ontkoppelen mislukt.',503)
   return studioResponse({ok:true})
  }
  const target=body.environment||project.id
  if(body.write&&target!==project.id)
   throw new StudioError('Schrijfopdrachten moeten vanuit de apart aangemelde omgeving zelf gebeuren.',403)
  if(body.write&&project.id==='production'&&body.productionConfirmation!=='PRODUCTION')
   throw new StudioError('Typ PRODUCTION om deze specifieke live wijziging expliciet te bevestigen.',403)
  if(body.write&&project.id==='production'&&target!=='production')
   throw new StudioError('Geen externe productiewijzigingen toegestaan.',403)
  const {data:credential,error}=await client.rpc('upt_god_database_secret',{p_token:token})
  if(error||!credential)throw new StudioError('Koppel een Supabase Management API-token in Koppelingen.',428)
  return studioResponse({
   environment:target,
   data:await queryDatabase(credential,body.query,!body.write,target),
  })
 }catch(error){
  if(error instanceof z.ZodError)return studioResponse({error:'Ongeldige SQL-aanvraag.'},400)
  return studioFailure(error)
 }
}
