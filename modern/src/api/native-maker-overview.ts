// Native read-only original Maker overview. The current original Main app
// stays untouched; this candidate authenticates using both signed QA SSR and
// private Maker session before accessing GitHub or Management APIs.
import type {SupabaseClient} from "@supabase/supabase-js"
import {makerGithubRead,makerBoundedJson} from "./native-maker-studio-reads.ts"

type Db=Pick<SupabaseClient,"rpc">
type Target="main"|"production"
type Run={
 id:number;name:string;event:string;head_sha:string;head_branch:string;
 status:string;conclusion:string|null;html_url:string;created_at:string
}
type Report={status:string;maker_action_required?:boolean;ai_severity?:string|null}
const repository="denkyaan/UpTillDawn-Crew"
const project="eakoavcieossazqzplke" // exact production project; never browser-controlled
const workflows={
 main:{ci:"fast-change-validation.yml",deploy:"deploy-main.yml",ciEvent:"push",deployEvent:"workflow_run"},
 production:{ci:"ci.yml",deploy:"deploy-cloudflare.yml",ciEvent:"workflow_dispatch",deployEvent:"workflow_dispatch"}
} as const
function newest(runs:Run[]|null,event:string){
 return runs?.filter(x=>x.event===event&&x.head_branch==="main")
  .sort((a,b)=>b.id-a.id)[0]||null
}
function summary(run:Run|null,currentSha:string|null){
 return run?{
  id:run.id,name:run.name,status:run.status,conclusion:run.conclusion,
  url:run.html_url,current:currentSha!==null&&run.head_sha===currentSha,
  sha:run.head_sha,createdAt:run.created_at
 }:null
}
async function loadRuns(filename:string,key?:string):Promise<Run[]>{
 const data=await makerGithubRead("/actions/workflows/"+filename+"/runs?branch=main&per_page=40",key)
 const runs=(data as {workflow_runs?:unknown})?.workflow_runs
 if(!Array.isArray(runs))throw Error("bad_github_runs")
 return runs as Run[]
}
const countSql="select count(*)::integer as checked,count(*) filter (where status not in ('resolved','auto_resolved'))::integer as open,count(*) filter (where status='needs_maker' or maker_action_required is true)::integer as needs_maker,count(*) filter (where status='failed')::integer as failed from (select status,maker_action_required from public.user_error_reports order by created_at desc limit 100) recent"
const expected=[
 "tasks:promotion_only","portal_role_assignments:approved",
 "admin_counterparties:id","admin_financial_documents:id",
 "admin_financial_lines:id","admin_payment_reminders:id",
 "admin_financial_payments:id","admin_operational_obligations:id",
 "admin_inventory_receipts:id","admin_ticket_sales:id",
 "admin_provider_event_mappings:id",
 "admin_provider_transactions:transaction_id",
 "admin_bank_statement_transactions:payment_reference",
 "admin_financial_line_imports:source_sha256",
 "admin_provider_bank_settlements:approved_by",
 "admin_provider_bank_settlement_items:provider_transaction_id",
 "upt_organization_leadership:managed_portal_grant",
 "upt_personnel_role_slots:role_two"
] as const
const schemaSql="with req(tab,col) as (values "+expected.map(e=>{
 const [table,column]=e.split(":");return "('"+table+"','"+column+"')"
}).join(",")+") select tab,col from req where not exists (select 1 from information_schema.columns c where c.table_schema='public' and c.table_name=req.tab and c.column_name=req.col) order by tab"

async function management(secret:string,sql:string):Promise<unknown|null>{
 try{
  const response=await fetch("https://api.supabase.com/v1/projects/"+project+"/database/query",{
   method:"POST",headers:{Authorization:"Bearer "+secret,"Content-Type":"application/json"},
   body:JSON.stringify({query:sql,read_only:true}),cache:"no-store",redirect:"manual",
   signal:AbortSignal.timeout(15_000)
  })
  if(!response.ok)return null
  return await makerBoundedJson(response,120_000)
 }catch{return null}
}
async function prodErrors(secret:string){
 const data=await management(secret,countSql)
 if(!Array.isArray(data))return null
 const row=data[0] as {checked?:unknown;open?:unknown;needs_maker?:unknown;failed?:unknown}|undefined
 if(!row||typeof row.checked!=="number")return null
 return {checked:row.checked,open:Number(row.open)||0,
  needsMaker:Number(row.needs_maker)||0,failed:Number(row.failed)||0}
}
async function prodSchema(secret:string){
 const data=await management(secret,schemaSql)
 if(!Array.isArray(data))return null
 const missing=data.filter(row=>row&&typeof row==="object"&&
  typeof (row as {tab?:unknown}).tab==="string"&&typeof (row as {col?:unknown}).col==="string")
  .map(row=>{const r=row as {tab:string;col:string};return r.tab+":"+r.col})
 return {ready:missing.length===0,missing,checked:expected.length}
}

export async function nativeMakerOverviewResponse(
 db:Db,token:string,request:Request
):Promise<Response>{
 const target:Target=new URL(request.url).searchParams.get("environment")==="production"?"production":"main"
 const [repositoryKey,databaseKey]=await Promise.allSettled([
  db.rpc("upt_god_repository_secret",{p_token:token}),
  db.rpc("upt_god_database_secret",{p_token:token})
 ])
 const credResult=repositoryKey.status==="fulfilled"?repositoryKey.value:null
 const dbResult=databaseKey.status==="fulfilled"?databaseKey.value:null
 const credential=credResult&&!credResult.error&&typeof credResult.data==="string"&&credResult.data?credResult.data:undefined
 const dbCredential=dbResult&&!dbResult.error&&typeof dbResult.data==="string"&&dbResult.data?dbResult.data:undefined
 const config=workflows[target]
 const [headResult,ciResult,deployResult,reportResult,schemaResult]=await Promise.allSettled([
  makerGithubRead("/git/ref/heads/main",credential),
  loadRuns(config.ci,credential),
  loadRuns(config.deploy,credential),
  target==="main"?db.rpc("upt_god_error_reports",{p_token:token,p_limit:100}):
   dbCredential?prodErrors(dbCredential):Promise.resolve(null),
  target==="production"&&dbCredential?prodSchema(dbCredential):Promise.resolve(null)
 ])
 const candidate=headResult.status==="fulfilled"?headResult.value as {object?:{sha?:string}}:null
 const mainHead=typeof candidate?.object?.sha==="string"&&/^[0-9a-f]{40}$/.test(candidate.object.sha)?candidate.object.sha:null
 const ciRuns=ciResult.status==="fulfilled"?ciResult.value:null
 const deployRuns=deployResult.status==="fulfilled"?deployResult.value:null
 const latestCi=newest(ciRuns,config.ciEvent)
 const latestDeploy=newest(deployRuns,config.deployEvent)
 const lastSuccessfulDeploy=deployRuns?.filter(x=>x.event===config.deployEvent&&
  x.head_branch==="main"&&x.conclusion==="success").sort((a,b)=>b.id-a.id)[0]||null
 const relevantHead=target==="main"?mainHead:latestCi?.head_sha||lastSuccessfulDeploy?.head_sha||null
 let reports:{checked:number;open:number;needsMaker:number;failed:number}|null=null
 if(target==="main"&&reportResult.status==="fulfilled"){
  const result=reportResult.value as {data?:unknown;error?:unknown}|null
  const values=result&&!result.error&&Array.isArray(result.data)?result.data as Report[]:null
  if(values){
   const open=values.filter(x=>!["resolved","auto_resolved"].includes(x.status))
   reports={checked:values.length,open:open.length,
    needsMaker:open.filter(x=>x.status==="needs_maker"||x.maker_action_required).length,
    failed:open.filter(x=>x.status==="failed").length}
  }
 }else if(target==="production"&&reportResult.status==="fulfilled"){
  reports=reportResult.value as typeof reports
 }
 return Response.json({
  repository,branch:"main",environment:target,
  githubConnected:Boolean(credential),databaseConnected:Boolean(dbCredential),
  githubAvailable:mainHead!==null,head:relevantHead,mainHead,
  deployedSha:target==="main"?lastSuccessfulDeploy?.head_sha||null:null,
  productionReleaseShaVerified:false,
  productionSchema:target==="production"&&schemaResult.status==="fulfilled"?schemaResult.value:null,
  ci:summary(latestCi,relevantHead),deploy:summary(latestDeploy,relevantHead),
  reports,checks:{code:mainHead!==null,ci:ciRuns!==null,deploy:deployRuns!==null,reports:reports!==null}
 },{headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}})
}
