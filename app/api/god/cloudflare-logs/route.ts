import {z} from 'zod'
import {authorizeStudio,StudioError,studioFailure,studioResponse} from '@/lib/god-studio-server'

const schema=z.object({
 environment:z.enum(['main','production']),
 limit:z.coerce.number().int().min(1).max(100).default(50),
 minutes:z.coerce.number().int().min(5).max(60).default(60),
}).strict()
const credential=z.object({
 accountId:z.string().regex(/^[a-f0-9]{32}$/i),
 token:z.string().min(20).max(500),
}).strict()
type Event={timestamp?:unknown;source?:unknown;'$metadata'?:unknown;'$workers'?:unknown}
type Metadata={service?:unknown;error?:unknown;message?:unknown}
type WorkerData={scriptName?:unknown}
type CFResult={success?:boolean;result?:{events?:{events?:unknown[]}};errors?:unknown[]}

function messageFromEvent(event:Event,meta:Metadata):string{
 const source=typeof event.source==='string'?event.source:typeof event.source==='object'?JSON.stringify(event.source):''
 const message=typeof meta.error==='string'?meta.error:typeof meta.message==='string'?meta.message:source
 return message.slice(0,1800)
}

export async function GET(request:Request){
 try{
  // The endpoint is only readable with a private expiring Maker God session.
  // No deployment credentials or project JWTs are forwarded to Cloudflare.
  await authorizeStudio(request)
  const input=schema.parse(Object.fromEntries(new URL(request.url).searchParams))
  const raw=process.env.CLOUDFLARE_OBSERVABILITY_CONFIG
  if(!raw)throw new StudioError('Cloudflare Workers Logs zijn nog niet verbonden. Configureer een afzonderlijk Observability-token.',428)
  let config:unknown
  try{config=JSON.parse(raw)}catch{throw new StudioError('Cloudflare-logging is niet correct geconfigureerd.',503)}
  const parsed=credential.safeParse(config)
  if(!parsed.success)throw new StudioError('Cloudflare-logging is niet correct geconfigureerd.',503)
  const script=input.environment==='main'?'uptilldawn-main':'uptilldawn-crew'
  const now=Date.now()
  const url='https://api.cloudflare.com/client/v4/accounts/'+parsed.data.accountId+'/workers/observability/telemetry/query'
  const response=await fetch(url,{
   method:'POST',headers:{
    Authorization:'Bearer '+parsed.data.token,
    'Content-Type':'application/json',
   },
   body:JSON.stringify({
    queryId:'god-mode-runtime-'+input.environment,
    dry:true,view:'events',limit:input.limit,
    timeframe:{from:now-input.minutes*60000,to:now},
    parameters:{datasets:['cloudflare-workers'],filterCombination:'and',
     filters:[{key:'$metadata.service',type:'string',operation:'eq',kind:'filter',value:script}]},
   }),
   cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(15000),
  })
  if(response.status===401||response.status===403)throw new StudioError('Cloudflare-token heeft geen Workers Observability-queryrechten.',403)
  if(!response.ok)throw new StudioError('Cloudflare Workers Logs zijn tijdelijk niet beschikbaar ('+response.status+').',503)
  const payload=await response.json() as CFResult
  const items=payload.result?.events?.events
  if(payload.success!==true||!Array.isArray(items))throw new StudioError('Cloudflare gaf geen geldig Workers Logs-resultaat terug.',502)
  const logs=items.slice(0,input.limit).flatMap(value=>{
   if(!value||typeof value!=='object')return []
   const event=value as Event,meta=(event.$metadata||{}) as Metadata,worker=(event.$workers||{}) as WorkerData
   // Defense in depth: never expose another Worker's logs even if the upstream
   // filter is misconfigured, missing, or returns wider account data.
   if(meta.service!==script&&worker.scriptName!==script)return []
   const date=typeof event.timestamp==='number'&&Number.isFinite(event.timestamp)?new Date(event.timestamp):null
   if(!date||Number.isNaN(date.getTime()))return []
   return [{timestamp:date.toISOString(),source:'Cloudflare · '+script,message:messageFromEvent(event,meta)}]
  })
  return studioResponse({environment:input.environment,source:'cloudflare-workers',readOnly:true,
   windowMinutes:input.minutes,script,logs})
 }catch(error){
  if(error instanceof z.ZodError)return studioResponse({error:'Ongeldige Cloudflare-logaanvraag.'},400)
  return studioFailure(error)
 }
}
