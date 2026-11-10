import { z } from 'zod'
import { authorizeStudio, studioBody, studioFailure, studioResponse, StudioError } from '@/lib/god-studio-server'

import {GOD_PROJECTS,isApprovedRuntime,canWriteGodSql,type GodEnvironment} from '@/lib/god-environments'

const environmentSchema=z.enum(['main','production'])
function guardRuntime(){
 if(!isApprovedRuntime(process.env.NEXT_PUBLIC_SUPABASE_URL))
  throw new StudioError('Onbekende UpTillDawn-omgeving.',403)
}

async function queryDatabase(credential: string, query: string, environment: GodEnvironment, readOnly: boolean) {
  if(environment==='production'&&!readOnly)throw new StudioError('Directe SQL-wijzigingen op productie zijn uitgeschakeld; gebruik CI production en Deploy production.',403)
  const response = await fetch(`https://api.supabase.com/v1/projects/${GOD_PROJECTS[environment].projectId}/database/query`, {
    method:'POST', headers:{Authorization:`Bearer ${credential}`,'Content-Type':'application/json'},
    body:JSON.stringify({query,read_only:readOnly}), cache:'no-store', redirect:'manual', signal:AbortSignal.timeout(30_000),
  })
  const data = await response.json().catch(()=>null)
  if(!response.ok)throw new StudioError(response.status===401||response.status===403?'De Supabase-sleutel mist de benodigde databasebevoegdheid.':`SQL mislukt: ${String(data?.message||data?.error||response.status).slice(0,1500)}`,400)
  return data as unknown
}

export async function GET(request: Request) {
  try {
    guardRuntime()
    const {client,token}=await authorizeStudio(request)
    const environment=environmentSchema.parse(new URL(request.url).searchParams.get('environment')||'main')
    const {data,error}=await client.rpc('upt_god_database_secret',{p_token:token})
    if(error)throw new StudioError('Databasekoppeling niet beschikbaar.',503)
    return studioResponse({connected:Boolean(data),environment,canWrite:canWriteGodSql(environment)})
  }catch(error){return studioFailure(error)}
}

export async function POST(request: Request) {
  try {
    guardRuntime()
    const {client,token}=await authorizeStudio(request)
    const body=z.discriminatedUnion('action',[
      z.object({action:z.literal('connect'),credential:z.string().trim().min(20).max(500),environment:environmentSchema.default('main')}).strict(),
      z.object({action:z.literal('query'),query:z.string().trim().min(1).max(100000),write:z.boolean(),environment:environmentSchema.default('main')}).strict(),
      z.object({action:z.literal('disconnect')}).strict(),
    ]).parse(await studioBody(request))
    if(body.action==='connect'){
      await queryDatabase(body.credential,'select current_database() as database',body.environment,true)
      const {error}=await client.rpc('upt_god_database_connect',{p_token:token,p_secret:body.credential})
      if(error)throw new StudioError('Koppeling opslaan mislukt.',503)
      return studioResponse({ok:true})
    }
    if(body.action==='disconnect'){
      const {error}=await client.rpc('upt_god_database_disconnect',{p_token:token})
      if(error)throw new StudioError('Ontkoppelen mislukt.',503)
      return studioResponse({ok:true})
    }
    if(body.environment==='production'&&body.write)throw new StudioError('Productie-SQL is alleen-lezen. Wijzigingen uitsluitend via gereviewde migraties en de expliciete productierelease.',403)
    const {data:credential,error}=await client.rpc('upt_god_database_secret',{p_token:token})
    if(error||!credential)throw new StudioError('Koppel een Supabase Management API-sleutel in Koppelingen om SQL uit te voeren.',428)
    return studioResponse({environment:body.environment,data:await queryDatabase(credential,body.query,body.environment,!body.write)})
  }catch(error){
    if(error instanceof z.ZodError)return studioResponse({error:'Ongeldige SQL-aanvraag.'},400)
    return studioFailure(error)
  }
}
