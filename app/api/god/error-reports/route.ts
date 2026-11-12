import { z } from 'zod'
import { authorizeStudio, github, StudioError, studioBody, studioFailure, studioResponse } from '@/lib/god-studio-server'
import {currentGodEnvironment} from '@/lib/god-mode-environments'
import {evaluateReleaseEvidence,type DeployEvidence,type ErrorReportEvidence} from '@/lib/god-mode-resolution-evidence'

const postSchema=z.discriminatedUnion('action',[
  z.object({action:z.literal('mark_working'),reportId:z.string().uuid()}).strict(),
  z.object({action:z.literal('resolve'),reportId:z.string().uuid(),note:z.string().trim().min(30).max(4000),sha:z.string().regex(/^[a-f0-9]{40}$/i)}).strict(),
])

export async function GET(request:Request){
  try{
    const context=await authorizeStudio(request)
    const limitRaw=new URL(request.url).searchParams.get('limit')
    const limit=Math.min(100,Math.max(1,Number(limitRaw||50)||50))
    const {data,error}=await context.client.rpc('upt_god_error_reports',{p_token:context.token,p_limit:limit})
    if(error)throw error
    return studioResponse({reports:Array.isArray(data)?data:[]})
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
    // An AI-generated diagnosis is never enough to close an incident.
    // Require a newer, successful deployment of the CURRENT environment,
    // linked to the actual incident and a meaningful Maker verification note.
    const environment=currentGodEnvironment(process.env.NEXT_PUBLIC_SUPABASE_URL)
    if(!environment)throw new StudioError('Onbekende Maker-omgeving.',503)
    const {data:items,error:readError}=await context.client.rpc('upt_god_error_reports',{p_token:context.token,p_limit:100})
    if(readError)throw new StudioError('Foutrapporten zijn tijdelijk niet controleerbaar.',503)
    const report=(Array.isArray(items)?items:[]).find((value:unknown)=>{
      return Boolean(value&&typeof value==='object'&&'id' in value&&(value as {id:unknown}).id===body.reportId)
    }) as ErrorReportEvidence|undefined
    if(!report)throw new StudioError('Foutrapport niet meer gevonden. Vernieuw de lijst.',409)
    const workflow=environment==='main'?'deploy-main.yml':'deploy-cloudflare.yml'
    const data=await github<{workflow_runs:DeployEvidence[]}>(`/actions/workflows/${workflow}/runs?per_page=50`)
    let productionCurrentSha:string|null=null
    if(environment==='production'){
      const tag=await github<{object:{sha:string}}>('/git/ref/tags/production-current')
      productionCurrentSha=tag.object.sha
    }
    const evidence=evaluateReleaseEvidence({
      environment,sha:body.sha,report,runs:data.workflow_runs||[],productionCurrentSha,
    })
    if(!evidence.ok)throw new StudioError(evidence.reason,409)
    const note=body.note+' | '+environment+' deployment verified: '+evidence.sha+' / GitHub Actions #'+evidence.runId
    const {error}=await context.client.rpc('upt_god_error_report_resolve',{
      p_token:context.token,
      p_report:body.reportId,
      p_note:note,
    })
    if(error)throw new StudioError('Foutrapport kon niet worden afgesloten. Vernieuw de status.',409)
    return studioResponse({ok:true,evidence:{sha:evidence.sha,runId:evidence.runId,environment}})
  }catch(error){
    if(error instanceof z.ZodError)return studioResponse({error:error.issues[0]?.message||'Ongeldige aanvraag.'},400)
    return studioFailure(error)
  }
}
