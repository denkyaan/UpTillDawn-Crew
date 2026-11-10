import {authorizeStudio,github,studioFailure,studioResponse} from '@/lib/god-studio-server'
import {GOD_ENVIRONMENTS,currentGodEnvironment} from '@/lib/god-mode-environments'

type Run={
 id:number
 name:string
 path:string
 event:string
 head_sha:string
 head_branch:string
 status:string
 conclusion:string|null
 html_url:string
 created_at:string
}
type OverviewRun={
 id:number;name:string;status:string;conclusion:string|null;url:string;
 current:boolean;sha:string;createdAt:string
}
type Report={status:string;maker_action_required?:boolean;ai_severity?:string|null}
const root='main'

async function safeRuns(path:string,credential?:string){
 const {workflow_runs}=await github<{workflow_runs:Run[]}>(
  '/actions/workflows/'+path+'/runs?branch=main&per_page=30',credential)
 return workflow_runs
}
function selectRun(runs:Run[]|null,sha:string|null,event:string):OverviewRun|null{
 if(!runs?.length)return null
 const pool=runs.filter(run=>run.head_branch===root&&run.event===event)
 const matching=sha?pool.filter(run=>run.head_sha===sha):[]
 const run=(matching.length?matching:pool).sort((a,b)=>b.id-a.id)[0]
 if(!run)return null
 return {
  id:run.id,name:run.name,status:run.status,conclusion:run.conclusion,
  url:run.html_url,current:sha!==null&&run.head_sha===sha,
  sha:run.head_sha,createdAt:run.created_at,
 }
}

export async function GET(request:Request){
 try{
  const context=await authorizeStudio(request)
  const {data:secret,error:secretError}=await context.client.rpc('upt_god_repository_secret',{p_token:context.token})
  const credential=!secretError&&typeof secret==='string'&&secret?secret:undefined
  const outcomes=await Promise.allSettled([
   github<{object:{sha:string}}>('/git/ref/heads/main',credential),
   safeRuns('fast-change-validation.yml',credential),
   safeRuns('deploy-main.yml',credential),
   context.client.rpc('upt_god_error_reports',{p_token:context.token,p_limit:100}),
   safeRuns('ci.yml',credential),
   safeRuns('deploy-cloudflare.yml',credential),
  ])
  const head=outcomes[0].status==='fulfilled'?outcomes[0].value.object.sha:null
  const ci=outcomes[1].status==='fulfilled'?outcomes[1].value:null
  const deploy=outcomes[2].status==='fulfilled'?outcomes[2].value:null
  const reportResult=outcomes[3].status==='fulfilled'?outcomes[3].value:null
  const ciProduction=outcomes[4].status==='fulfilled'?outcomes[4].value:null
  const deployProduction=outcomes[5].status==='fulfilled'?outcomes[5].value:null
  const currentEnvironment=currentGodEnvironment(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const reports=reportResult&&!reportResult.error&&Array.isArray(reportResult.data)
   ? reportResult.data as Report[]:null
  const open=reports?.filter(report=>!['resolved','auto_resolved'].includes(report.status))??[]
  const maker=open.filter(report=>report.status==='needs_maker'||report.maker_action_required)
  return studioResponse({
   repository:'denkyaan/UpTillDawn-Crew',branch:'main',environment:currentEnvironment||'unknown',
   environments:{
    main:{origin:GOD_ENVIRONMENTS.main.origin,ci:selectRun(ci,head,'push'),deploy:selectRun(deploy,head,'workflow_run'),logsAvailable:currentEnvironment==='main'&&reports!==null},
    production:{origin:GOD_ENVIRONMENTS.production.origin,ci:selectRun(ciProduction,null,'workflow_dispatch'),deploy:selectRun(deployProduction,null,'workflow_dispatch'),logsAvailable:currentEnvironment==='production'&&reports!==null,releaseShaVerified:false},
   },
   githubConnected:Boolean(credential),githubAvailable:head!==null,
   head,
   ci:selectRun(ci,head,'push'),
   deploy:selectRun(deploy,head,'workflow_run'),
   reports:reports?{
    checked:reports.length,open:open.length,needsMaker:maker.length,
    failed:open.filter(report=>report.status==='failed').length,
   }:null,
   checks:{
    code:head!==null,
    ci:ci!==null,
    deploy:deploy!==null,
    reports:reports!==null,
    ciProduction:ciProduction!==null,
    deployProduction:deployProduction!==null,
   },
  })
 }catch(error){return studioFailure(error)}
}
