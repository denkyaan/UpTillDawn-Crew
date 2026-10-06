import { getCloudflareContext } from '@opennextjs/cloudflare'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/crew-server'

export const runtime='nodejs'

const schema=z.object({message:z.string().trim().min(1).max(4000),eventId:z.string().uuid().optional(),contextKey:z.string().trim().max(80).optional()})

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

  const [{data:events},{data:alerts},{data:incidents},{data:inventory},{data:recovery},{data:guestlist},{data:backstage},{data:sales},{data:registers}]=await Promise.all([
    s.from('events').select('id,name,status,start_at,end_at').neq('status','archived').order('start_at').limit(20),
    s.rpc('upt_operational_alerts'),
    s.from('incidents').select('event_id,workplace_id,status,urgency,category,created_at').is('resolved_at',null).limit(50),
    s.from('inventory_items').select('event_id,workplace_id,name,available_quantity,reorder_threshold,missing_quantity,damaged_quantity').eq('is_active',true).limit(100),
    s.rpc('upt_recovery_readiness'),
    s.from('event_guestlist_entries').select('id,event_id,name,entry_type,spots_total,spots_checked_in,notes').eq('is_active',true).limit(500),
    s.from('artist_backstage_checklists').select('event_id,guestlist_entry_id,drinks,drinks_ready,artist_received').limit(500),
    s.from('sales_transactions').select('event_id,workplace_id,product_name,sale_category,quantity,total_cents,payment_method,transaction_type,created_at').order('created_at',{ascending:false}).limit(500),
    s.from('sales_registers').select('event_id,workplace_id,opening_cash_cents').limit(100),
  ])

  let ai:{run:(model:string,input:Record<string,unknown>)=>Promise<unknown>}|undefined
  try{ai=(getCloudflareContext().env as {AI?:typeof ai}).AI}catch{}
  if(!ai)return Response.json({error:'AI is niet beschikbaar op deze omgeving.'},{status:503})

  const artistPresence=(guestlist||[])
    .filter(row=>row.entry_type==='artist')
    .map(row=>({
      eventId:row.event_id,
      name:row.name,
      present:row.spots_checked_in>0,
      checkedIn:row.spots_checked_in,
      totalSpots:row.spots_total,
      backstage:(backstage||[]).find(item=>item.guestlist_entry_id===row.id)?.artist_received??null,
    }))

  const salesByEvent=new Map<string,{net:number;cash:number;card:number;merch:number;tokens:number}>()
  for(const tx of sales||[]){
    const bucket=salesByEvent.get(tx.event_id)||{net:0,cash:0,card:0,merch:0,tokens:0}
    const amount=Number(tx.total_cents||0)*(tx.transaction_type==='refund'?-1:1)
    bucket.net+=amount
    if(tx.payment_method==='cash')bucket.cash+=amount
    else bucket.card+=amount
    if(tx.sale_category==='merch')bucket.merch+=amount
    else bucket.tokens+=amount
    salesByEvent.set(tx.event_id,bucket)
  }

  const eventId=parsed.data.eventId
  const inEvent=<T extends {event_id?:string|null;id?:string|null}>(rows:T[])=>eventId?rows.filter(row=>row.event_id===eventId||row.id===eventId):rows
  const context={
    activeEventId:eventId||null,
    activeSection:parsed.data.contextKey||null,
    events:inEvent(events||[]),
    operationalAlerts:inEvent((alerts||[]) as Array<{event_id?:string}>).slice(0,50),
    openIncidents:inEvent(incidents||[]),
    inventoryExceptions:inEvent(inventory||[]).filter(i=>i.available_quantity<=i.reorder_threshold||i.missing_quantity>0||i.damaged_quantity>0),
    artistPresence,
    guestlist:inEvent(guestlist||[]).slice(0,300),
    backstageHospitality:inEvent(backstage||[]).slice(0,300),
    sales:[...salesByEvent.entries()].filter(([id])=>!eventId||id===eventId).map(([eventId,value])=>({eventId,...value})),
    cashRegisters:inEvent(registers||[]),
    recovery,
  }

  try{
    const raw=await ai.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast',{
      messages:[
        {role:'system',content:'Je bent de operationele admin-assistent van Up Till Dawn Crew. Antwoord in het Nederlands. Gebruik uitsluitend de meegegeven actuele platformcontext en geef voorrang aan activeSection en activeEventId wanneer die aanwezig zijn. Je helpt expliciet met planning, inventaris, Inkom & Guestlist, artiestaanwezigheid/backstage, hospitality, Merch/Tokens/Sales en cash/kaart-kassa-opvolging. Benoem concrete risico’s, feiten en veilige volgende acties. Voer geen wijzigingen uit, verzin geen data en presenteer kost/payrollwaarden als schattingen.'},
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
