import {authorizeStudio,github,studioFailure,studioResponse} from '@/lib/god-studio-server'

type Target='main'|'production'
type Run={
 id:number;name:string;event:string;head_sha:string;head_branch:string;
 status:string;conclusion:string|null;html_url:string;created_at:string
}
type OverviewRun={
 id:number;name:string;status:string;conclusion:string|null;url:string;
 current:boolean;sha:string;createdAt:string
}
type Report={status:string;maker_action_required?:boolean;ai_severity?:string|null}
const workflows={
 main:{ci:'fast-change-validation.yml',deploy:'deploy-main.yml',ciEvent:'push',deployEvent:'workflow_run'},
 production:{ci:'ci.yml',deploy:'deploy-cloudflare.yml',ciEvent:'workflow_dispatch',deployEvent:'workflow_dispatch'},
} as const
async function loadRuns(path:string,credential?:string){
 const {workflow_runs}=await github<{workflow_runs:Run[]}>('/actions/workflows/'+path+'/runs?branch=main&per_page=40',credential)
 return workflow_runs
}
function newest(runs:Run[]|null,event:string){
 return runs?.filter(run=>run.event===event&&run.head_branch==='main')
 .sort((a,b)=>b.id-a.id)[0]||null
}
function summary(run:Run|null,currentSha:string|null):OverviewRun|null{
 return run?{
  id:run.id,name:run.name,status:run.status,conclusion:run.conclusion,
  url:run.html_url,current:currentSha!==null&&run.head_sha===currentSha,
  sha:run.head_sha,createdAt:run.created_at,
 }:null
}
async function productionErrorCounts(credential:string){
 const query="select count(*)::integer as checked,count(*) filter (where status not in ('resolved','auto_resolved'))::integer as open,count(*) filter (where status='needs_maker' or maker_action_required is true)::integer as needs_maker,count(*) filter (where status='failed')::integer as failed from (select status,maker_action_required from public.user_error_reports order by created_at desc limit 100) recent"
 const response=await fetch('https://api.supabase.com/v1/projects/eakoavcieossazqzplke/database/query',{
  method:'POST',headers:{Authorization:'Bearer '+credential,'Content-Type':'application/json'},
  body:JSON.stringify({query,read_only:true}),cache:'no-store',redirect:'manual',
  signal:AbortSignal.timeout(15000),
 })
 if(!response.ok)return null
 const data=await response.json() as unknown
 const rows=Array.isArray(data)?data:[]
 const row=rows[0] as {checked?:number;open?:number;needs_maker?:number;failed?:number}|undefined
 if(!row||typeof row.checked!=='number')return null
 return {checked:row.checked,open:row.open||0,needsMaker:row.needs_maker||0,failed:row.failed||0}
}
async function releaseSchemaReadiness(credential:string){
  // Same minimum administration contract as the Deploy production workflow.
  const expected=[
   'tasks:promotion_only','portal_role_assignments:approved',
   'admin_counterparties:id','admin_financial_documents:id',
   'admin_financial_lines:id','admin_payment_reminders:id',
   'admin_financial_payments:id','admin_operational_obligations:id',
   'admin_inventory_receipts:id','admin_ticket_sales:id',
   'admin_provider_event_mappings:id',
   'admin_provider_transactions:transaction_id',
   'admin_bank_statement_transactions:payment_reference',
   'admin_financial_line_imports:source_sha256',
   'admin_provider_bank_settlements:approved_by',
   'admin_provider_bank_settlement_items:provider_transaction_id',
   'upt_organization_leadership:managed_portal_grant',
   'upt_personnel_role_slots:role_two',
  ] as const
  const values=expected.map(e=>{const [table,column]=e.split(':');return "('"+table+"','"+column+"')"}).join(',')
  const query='with req(tab,col) as (values '+values+") select tab,col from req where not exists (select 1 from information_schema.columns c where c.table_schema='public' and c.table_name=req.tab and c.column_name=req.col) order by tab"
  const response=await fetch('https://api.supabase.com/v1/projects/eakoavcieossazqzplke/database/query',{
   method:'POST',headers:{Authorization:'Bearer '+credential,'Content-Type':'application/json'},
   body:JSON.stringify({query,read_only:true}),cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(15000),
  })
  if(!response.ok)return null
  const data=await response.json() as unknown
  if(!Array.isArray(data))return null
  const missing=data.filter(row=>row&&typeof row==='object'&&typeof (row as {tab?:unknown}).tab==='string')
   .map(row=>(row as {tab:string;col:string}).tab+':'+(row as {tab:string;col:string}).col)
  return {ready:missing.length===0,missing,checked:expected.length}
}

export async function GET(request:Request){
 try{
  const context=await authorizeStudio(request)
  const target:Target=new URL(request.url).searchParams.get('environment')==='production'?'production':'main'
  const {data:secret,error:secretError}=await context.client.rpc('upt_god_repository_secret',{p_token:context.token})
  const credential=!secretError&&typeof secret==='string'&&secret?secret:undefined
  const {data:dbCredential}=await context.client.rpc('upt_god_database_secret',{p_token:context.token})
  const config=workflows[target]
  const outcomes=await Promise.allSettled([
   github<{object:{sha:string}}>('/git/ref/heads/main',credential),
   loadRuns(config.ci,credential),
   loadRuns(config.deploy,credential),
   target==='main'
    ?context.client.rpc('upt_god_error_reports',{p_token:context.token,p_limit:100})
    :(typeof dbCredential==='string'&&dbCredential?productionErrorCounts(dbCredential):Promise.resolve(null)),
   target==='production'&&typeof dbCredential==='string'&&dbCredential
    ?releaseSchemaReadiness(dbCredential):Promise.resolve(null),
  ])
  const mainHead=outcomes[0].status==='fulfilled'?outcomes[0].value.object.sha:null
  const ciRuns=outcomes[1].status==='fulfilled'?outcomes[1].value:null
  const deployRuns=outcomes[2].status==='fulfilled'?outcomes[2].value:null
  const latestCi=newest(ciRuns,config.ciEvent)
  const latestDeploy=newest(deployRuns,config.deployEvent)
  const lastSuccessfulDeploy=deployRuns?.filter(run=>run.event===config.deployEvent&&run.head_branch==='main'&&run.conclusion==='success')
   .sort((a,b)=>b.id-a.id)[0]||null
  const relevantHead=target==='main'?mainHead:latestCi?.head_sha||lastSuccessfulDeploy?.head_sha||null
  let reports:{checked:number;open:number;needsMaker:number;failed:number}|null=null
  if(target==='main'){
   const raw=outcomes[3].status==='fulfilled'?outcomes[3].value:null
   const records=raw&&'error' in raw&&!raw.error&&Array.isArray(raw.data)?raw.data as Report[]:null
   if(records){
    const open=records.filter(r=>!['resolved','auto_resolved'].includes(r.status))
    reports={checked:records.length,open:open.length,
     needsMaker:open.filter(r=>r.status==='needs_maker'||r.maker_action_required).length,
     failed:open.filter(r=>r.status==='failed').length}
   }
  }else if(outcomes[3].status==='fulfilled')reports=outcomes[3].value as typeof reports
  return studioResponse({
   repository:'denkyaan/UpTillDawn-Crew',branch:'main',environment:target,
   githubConnected:Boolean(credential),databaseConnected:Boolean(dbCredential),githubAvailable:mainHead!==null,
   // A workflow_dispatch head_sha can differ from the explicitly pinned release_sha.
   // Never present it as the verified live production revision without deployment evidence.
   head:relevantHead,mainHead,deployedSha:target==='main'?lastSuccessfulDeploy?.head_sha||null:null,
   productionReleaseShaVerified:false,
   productionSchema:target==='production'&&outcomes[4].status==='fulfilled'?outcomes[4].value:null,
   ci:summary(latestCi,relevantHead),deploy:summary(latestDeploy,relevantHead),
   reports,checks:{code:mainHead!==null,ci:ciRuns!==null,deploy:deployRuns!==null,reports:reports!==null},
  })
 }catch(error){return studioFailure(error)}
}
