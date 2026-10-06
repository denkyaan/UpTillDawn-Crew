import { z } from 'zod'
import { authorizeStudio, studioBody, studioFailure, studioResponse } from '@/lib/god-studio-server'

const postSchema=z.discriminatedUnion('action',[
  z.object({action:z.literal('mark_working'),reportId:z.string().uuid()}).strict(),
  z.object({action:z.literal('resolve'),reportId:z.string().uuid(),note:z.string().trim().max(4000).optional().default('')}).strict(),
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
