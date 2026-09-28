import { getCloudflareContext } from '@opennextjs/cloudflare'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/crew-server'

export const runtime='nodejs'

const schema=z.object({message:z.string().trim().min(1).max(4000)})

function crossSite(request:Request){
  const site=request.headers.get('sec-fetch-site')
  const origin=request.headers.get('origin')
  return site==='cross-site'||Boolean(origin&&origin!==new URL(request.url).origin)
}

export async function POST(request:Request){
  if(crossSite(request))return Response.json({error:'Ongeldige oorsprong.'},{status:403})
  const s=await createClient()
  const {data:{user}}=await s.auth.getUser()
  if(!user)return Response.json({error:'Aanmelden vereist.'},{status:401})
  const [{data:approved},{data:isAdmin}]=await Promise.all([
    s.rpc('upt_is_approved'),
    s.rpc('upt_is_admin',{uid:user.id}),
  ])
  if(!approved||!isAdmin)return Response.json({error:'Geen toegang.'},{status:403})
  const parsed=schema.safeParse(await request.json().catch(()=>null))
  if(!parsed.success)return Response.json({error:'Ongeldige AI-aanvraag.'},{status:400})

  const [{data:events},{data:alerts},{data:incidents},{data:inventory},{data:recovery}]=await Promise.all([
    s.from('events').select('id,name,status,start_at,end_at').neq('status','archived').order('start_at').limit(20),
    s.rpc('upt_operational_alerts'),
    s.from('incidents').select('event_id,workplace_id,status,urgency,category,created_at').is('resolved_at',null).limit(50),
    s.from('inventory_items').select('event_id,workplace_id,name,available_quantity,reorder_threshold,missing_quantity,damaged_quantity').eq('is_active',true).limit(100),
    s.rpc('upt_recovery_readiness'),
  ])

  let ai:{run:(model:string,input:Record<string,unknown>)=>Promise<unknown>}|undefined
  try{ai=(getCloudflareContext().env as {AI?:typeof ai}).AI}catch{}
  if(!ai)return Response.json({error:'AI is niet beschikbaar op deze omgeving.'},{status:503})

  const context={
    events:events||[],
    operationalAlerts:(alerts||[]).slice(0,50),
    openIncidents:incidents||[],
    inventoryExceptions:(inventory||[]).filter(i=>i.available_quantity<=i.reorder_threshold||i.missing_quantity>0||i.damaged_quantity>0),
    recovery,
  }

  try{
    const raw=await ai.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast',{
      messages:[
        {role:'system',content:'Je bent de operationele admin-assistent van Up Till Dawn Crew. Antwoord in het Nederlands. Gebruik uitsluitend de meegegeven actuele platformcontext. Benoem concrete risico’s, feiten en veilige volgende acties. Voer geen wijzigingen uit, verzin geen data en presenteer kost/payrollwaarden als schattingen.'},
        {role:'user',content:JSON.stringify({request:parsed.data.message,context})},
      ],
      max_tokens:900,
      temperature:0.1,
    })
    const answer=typeof (raw as {response?:unknown})?.response==='string'?(raw as {response:string}).response:'AI gaf geen bruikbaar antwoord.'
    return Response.json({answer})
  }catch{
    return Response.json({error:'AI-assistent kon de aanvraag niet verwerken.'},{status:502})
  }
}
