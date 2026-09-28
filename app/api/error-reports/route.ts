import { getCloudflareContext } from '@opennextjs/cloudflare'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/crew-server'
import { processErrorReport, type ErrorAiBinding } from '@/lib/error-report-ai'

export const runtime='nodejs'
export const dynamic='force-dynamic'

const reportSchema=z.object({
  route:z.string().trim().min(1).max(500),
  errorName:z.string().trim().max(200).optional().default(''),
  errorMessage:z.string().trim().min(1).max(4000),
  stackTrace:z.string().max(12000).optional().default(''),
  source:z.enum(['boundary','runtime','promise','manual','api']).default('manual'),
  clientContext:z.record(z.unknown()).optional().default({}),
}).strict()

function crossSite(request:Request){
  const site=request.headers.get('sec-fetch-site')
  const origin=request.headers.get('origin')
  return site==='cross-site'||Boolean(origin&&origin!==new URL(request.url).origin)
}

async function authenticatedClient(){
  const s=await createClient()
  const {data:{user}}=await s.auth.getUser()
  if(!user)return {s,user:null,approved:false}
  const {data:approved}=await s.rpc('upt_is_approved')
  return {s,user,approved:approved===true}
}

export async function GET(request:Request){
  if(crossSite(request))return Response.json({error:'Ongeldige oorsprong.'},{status:403})
  const {s,user,approved}=await authenticatedClient()
  if(!user||!approved)return Response.json({error:'Aanmelden vereist.'},{status:401})
  const id=new URL(request.url).searchParams.get('id')
  if(!id||!z.string().uuid().safeParse(id).success)return Response.json({error:'Ongeldig foutrapport.'},{status:400})

  const {data,error}=await s
    .from('user_error_reports')
    .select('id,status,ai_category,ai_severity,ai_summary,ai_user_message,auto_action,maker_action_required,updated_at,resolved_at')
    .eq('id',id)
    .maybeSingle()

  if(error)return Response.json({error:'Foutrapport kon niet worden geladen.'},{status:500})
  if(!data)return Response.json({error:'Foutrapport niet gevonden.'},{status:404})
  return Response.json({report:data},{headers:{'Cache-Control':'no-store'}})
}

export async function POST(request:Request){
  if(crossSite(request))return Response.json({error:'Ongeldige oorsprong.'},{status:403})
  const {s,user,approved}=await authenticatedClient()
  if(!user||!approved)return Response.json({error:'Aanmelden vereist.'},{status:401})

  const parsed=reportSchema.safeParse(await request.json().catch(()=>null))
  if(!parsed.success)return Response.json({error:'Ongeldig foutrapport.'},{status:400})

  const input=parsed.data
  const {data,error}=await s.rpc('upt_report_client_error',{
    p_route:input.route,
    p_error_name:input.errorName||undefined,
    p_error_message:input.errorMessage,
    p_stack_trace:input.stackTrace||undefined,
    p_source:input.source,
    p_client_context:input.clientContext,
  })

  if(error){
    console.error('[error-report] opslaan mislukt',{code:error.code})
    return Response.json({error:error.message||'Foutrapport kon niet worden opgeslagen.'},{status:400})
  }

  const result=(data&&typeof data==='object'&&!Array.isArray(data)?data:{}) as {id?:unknown;deduplicated?:unknown}
  const id=typeof result.id==='string'?result.id:null
  if(!id)return Response.json({error:'Foutrapport kon niet worden opgeslagen.'},{status:500})

  let ai:ErrorAiBinding|undefined
  let waitUntil:((promise:Promise<unknown>)=>void)|undefined
  try{
    const cf=getCloudflareContext() as unknown as {
      env?:{AI?:ErrorAiBinding}
      ctx?:{waitUntil?:(promise:Promise<unknown>)=>void}
    }
    ai=cf.env?.AI
    waitUntil=cf.ctx?.waitUntil?.bind(cf.ctx)
  }catch{
    // Local/non-Workers execution still processes the report, only without a binding.
  }

  const job=processErrorReport(s,id,ai)
  if(waitUntil)waitUntil(job)
  else void job.catch(error=>console.error('[error-report] background job failed',error))

  return Response.json({
    ok:true,
    id,
    deduplicated:result.deduplicated===true,
    message:'Fout gemeld. De AI-assistent bekijkt dit nu op de achtergrond.',
  },{status:202,headers:{'Cache-Control':'no-store'}})
}
