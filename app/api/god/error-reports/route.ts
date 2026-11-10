import { z } from 'zod'
import { GOD_PROJECTS } from '@/lib/god-environments'
import { authorizeStudio, studioBody, studioFailure, studioResponse } from '@/lib/god-studio-server'

const postSchema=z.discriminatedUnion('action',[
  z.object({action:z.literal('mark_working'),reportId:z.string().uuid()}).strict(),
  z.object({action:z.literal('resolve'),reportId:z.string().uuid(),note:z.string().trim().max(4000).optional().default('')}).strict(),
])

export async function GET(request:Request){
  try{
    const context=await authorizeStudio(request)
    const params=new URL(request.url).searchParams
    const limitRaw=params.get('limit')
    const limit=Math.min(100,Math.max(1,Number(limitRaw||50)||50))
    const environment=params.get('environment')||'main'
    if(environment!=='main'&&environment!=='production')
      return studioResponse({error:'Ongeldige omgevingskeuze.'},400)
    if(environment==='production'){
      const {data:credential,error:keyError}=await context.client.rpc('upt_god_database_secret',{p_token:context.token})
      if(keyError||!credential)return studioResponse({error:'Koppel een Supabase Management API-sleutel met productietoegang in Koppelingen om productiefouten te bekijken.'},428)
      // Fixed, bounded SELECT only: never proxy arbitrary SQL or production writes.
      const query=`select id,route,error_name,error_message,stack_trace,status,ai_category,ai_severity,ai_summary,ai_user_message,maker_action_required,maker_action,god_prompt,reported_count,processing_attempts,created_at,updated_at from public.user_error_reports order by created_at desc limit ${limit}`
      const response=await fetch(`https://api.supabase.com/v1/projects/${GOD_PROJECTS.production.projectId}/database/query`,{
        method:'POST',headers:{Authorization:`Bearer ${credential}`,'Content-Type':'application/json'},
        body:JSON.stringify({query,read_only:true}),
        cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(25000),
      })
      if(!response.ok)return studioResponse({error:'Productiefouten zijn momenteel niet bereikbaar via de geconfigureerde Supabase-toegang.'},response.status===401||response.status===403?403:503)
      const rows:unknown=await response.json()
      if(!Array.isArray(rows))throw new Error('Unexpected production report response')
      return studioResponse({reports:rows,environment:'production',source:'supabase-management'})
    }
    const {data,error}=await context.client.rpc('upt_god_error_reports',{p_token:context.token,p_limit:limit})
    if(error)throw error
    return studioResponse({reports:Array.isArray(data)?data:[],environment:'main',source:'god-session'})
  }catch(error){
    return studioFailure(error)
  }
}

export async function POST(request:Request){
  try{
    const context=await authorizeStudio(request)
    const body=postSchema.parse(await studioBody(request))
    if(body.action==='mark_working'){
      const {error}=await context.client.rpc('upt_god_error_report_mark_working',{p_token:context.token,p_report:body.reportId})
      if(error)throw error
      return studioResponse({ok:true})
    }
    const {error}=await context.client.rpc('upt_god_error_report_resolve',{
      p_token:context.token,
      p_report:body.reportId,
      p_note:body.note||undefined,
    })
    if(error)throw error
    return studioResponse({ok:true})
  }catch(error){
    if(error instanceof z.ZodError)return studioResponse({error:error.issues[0]?.message||'Ongeldige aanvraag.'},400)
    return studioFailure(error)
  }
}
