// Original Maker source change proposals, history restore and CI-gated Main
// publication. No Next/OpenNext or Node Buffer. The public QA write gate in
// worker.ts denies every POST before user auth or external GitHub I/O.
import {z} from "zod"
import type {SupabaseClient} from "@supabase/supabase-js"
import {makerGithubRead,makerEditablePath,makerBoundedJson}
 from "./native-maker-studio-reads.ts"
import {makerAuthorization,makerRequestBody,makerJson,makerError,MakerExecutionError}
 from "./native-maker-execution-guard.ts"

const sha=z.string().regex(/^[a-f0-9]{40}$/)
const path=z.string().refine(makerEditablePath,"Ongeldig of niet-bewerkbaar bronbestand.")
const change=z.object({path,content:z.string().max(500_000).nullable()}).strict()
const set=z.object({
 base:sha,title:z.string().trim().min(3).max(120),
 changes:z.array(change).min(1).max(30)
}).strict().superRefine((value,context)=>{
 if(new Set(value.changes.map(c=>c.path)).size!==value.changes.length)
  context.addIssue({code:"custom",message:"Elk bestand mag maar eenmaal voorkomen."})
 if(value.changes.reduce((n,c)=>n+new TextEncoder().encode(c.content||"").byteLength,0)>1_500_000)
  context.addIssue({code:"custom",message:"Deze wijziging is te groot."})
})
const action=z.discriminatedUnion("action",[
 set.extend({action:z.literal("save")}),
 z.object({action:z.literal("restore"),target:sha,base:sha}).strict(),
 z.object({action:z.literal("publish"),number:z.number().int().positive(),sha}).strict()
])
const repository="denkyaan/UpTillDawn-Crew"
type Commit={sha:string;tree:{sha:string};message?:string}
type Tree={sha:string;truncated?:boolean;tree:Array<{
 path:string;type:string;mode:string;sha:string;size?:number
}>}
type Pull={number:number;html_url:string;state:string;merged:boolean;
 head:{sha:string;ref:string;repo?:{full_name?:string}};base:{ref:string}}
type Run={id:number;event:string;head_branch:string;head_sha:string;
 status:string;conclusion:string|null}
async function githubMutation(url:string,credential:string,method:"POST"|"PUT",payload:unknown){
 if(!/^\/[a-z0-9/]+$/.test(url)||url.includes(".."))
  throw new MakerExecutionError("Ongeldige GitHub-aanvraag.",400)
 const response=await fetch("https://api.github.com/repos/"+repository+url,{
  method,headers:{
   Accept:"application/vnd.github+json",
   "X-GitHub-Api-Version":"2022-11-28",
   "User-Agent":"UpTillDawn-GodMode",
   Authorization:"Bearer "+credential,
   "Content-Type":"application/json"
  },
  body:JSON.stringify(payload),redirect:"manual",cache:"no-store",
  signal:AbortSignal.timeout(25_000)
 })
 if(!response.ok){
  if([409,412,422].includes(response.status))
   throw new MakerExecutionError("GitHub heeft een conflicterende versie geweigerd.",409)
  throw new MakerExecutionError("GitHub kon het voorstel niet opslaan of samenvoegen.",503)
 }
 return makerBoundedJson(response,500_000)
}
async function repositoryKey(db:Pick<SupabaseClient,"rpc">,token:string){
 const {data,error}=await db.rpc("upt_god_repository_secret",{p_token:token})
 if(error||typeof data!=="string"||!data)
  throw new MakerExecutionError("Koppel eerst een GitHub-sleutel in God Mode.",428)
 return data
}
async function mainHead(key:string):Promise<string>{
 const data=await makerGithubRead("/git/ref/heads/main",key) as {object?:{sha?:unknown}}
 const result=sha.safeParse(data?.object?.sha)
 if(!result.success)throw new MakerExecutionError("Main-broncode kon niet worden gevalideerd.",503)
 return result.data
}
async function propose(key:string,base:string,tree:string,title:string){
 const commit=await githubMutation("/git/commits",key,"POST",{message:title,tree,parents:[base]}) as
  {sha:unknown}
 const committed=sha.safeParse(commit.sha)
 if(!committed.success)throw new MakerExecutionError("GitHub gaf geen geldige commit terug.",503)
 const branch="god-mode/"+Date.now()+"-"+crypto.randomUUID().slice(0,8)
 await githubMutation("/git/refs",key,"POST",{ref:"refs/heads/"+branch,sha:committed.data})
 const pull=await githubMutation("/pulls",key,"POST",{
  title,head:branch,base:"main",
  body:"Gemaakt in God Mode. Controleer gewijzigde code en CI-resultaten vóór publicatie."
 }) as Partial<Pull>
 if(typeof pull.number!=="number"||typeof pull.html_url!=="string")
  throw new MakerExecutionError("Het voorstel kon niet als pull request worden geopend.",503)
 return {sha:committed.data,branch,number:pull.number,url:pull.html_url}
}
async function save(key:string,body:z.infer<typeof set>){
 if(await mainHead(key)!==body.base)
  throw new MakerExecutionError("Er staat nieuwere code op main. Bewaar je concept en laad de actuele versie.",409)
 const [base,tree]=await Promise.all([
  makerGithubRead("/git/commits/"+body.base,key) as Promise<Commit>,
  makerGithubRead("/git/trees/"+body.base+"?recursive=1",key) as Promise<Tree>
 ])
 if(!tree||tree.truncated||!Array.isArray(tree.tree))
  throw new MakerExecutionError("De volledige bestandslijst ontbreekt.",409)
 const entries=body.changes.map(value=>{
  const current=tree.tree.find(item=>item.path===value.path)
  if(current&&(current.type!=="blob"||!["100644","100755"].includes(current.mode)))
   throw new MakerExecutionError("Dit bestandstype kan niet worden gewijzigd.",400)
  if(value.content===null&&!current)
   throw new MakerExecutionError("Het te verwijderen bestand bestaat niet.",400)
  return {path:value.path,mode:current?.mode||"100644",type:"blob",
   ...(value.content===null?{sha:null}:{content:value.content})}
 })
 const newTree=await githubMutation("/git/trees",key,"POST",{
  base_tree:base.tree.sha,tree:entries
 }) as {sha:unknown}
 const target=sha.safeParse(newTree.sha)
 if(!target.success)throw new MakerExecutionError("De GitHub-boom ontbreekt.",503)
 return makerJson({ok:true,proposal:await propose(key,body.base,target.data,body.title)})
}
async function restore(key:string,target:string,base:string){
 if(await mainHead(key)!==base)
  throw new MakerExecutionError("Main is gewijzigd. Vernieuw eerst de versiegeschiedenis.",409)
 const commit=await makerGithubRead("/git/commits/"+target,key) as Commit
 const parsed=sha.safeParse(commit?.tree?.sha)
 if(!parsed.success)throw new MakerExecutionError("Onbekende herstelversie.",409)
 return makerJson({ok:true,
  proposal:await propose(key,base,parsed.data,"Herstel broncode naar "+target.slice(0,8)),
  notice:"Herstelt broncode; bestaande databasegegevens worden niet teruggedraaid."
 })
}
async function publish(key:string,number:number,headSha:string){
 const pull=await makerGithubRead("/pulls/"+number,key) as Pull
 if(pull.head?.repo?.full_name!==repository||
  !pull.head.ref.startsWith("god-mode/")||
  pull.base?.ref!=="main"||pull.head.sha!==headSha||pull.state!=="open")
  throw new MakerExecutionError("Het voorstel is gewijzigd of al gesloten.",409)
 const x=await makerGithubRead("/actions/workflows/fast-change-validation.yml/runs?head_sha="+headSha+"&per_page=100",key) as
  {workflow_runs?:Run[]}
 if(!Array.isArray(x.workflow_runs))throw new MakerExecutionError("CI-bewijs ontbreekt.",409)
 const latest=x.workflow_runs.filter(run=>run.head_sha===headSha&&
  run.head_branch===pull.head.ref&&run.event==="pull_request").sort((a,b)=>b.id-a.id)[0]
 if(!latest||latest.status!=="completed"||latest.conclusion!=="success")
  throw new MakerExecutionError("Publiceren kan pas nadat CI main voor precies deze voorstelversie is geslaagd.",409)
 const compare=await makerGithubRead("/compare/main..."+headSha,key) as {behind_by?:number}
 if(!Number.isInteger(compare.behind_by)||compare.behind_by!>0)
  throw new MakerExecutionError("Main is intussen gewijzigd. Werk het voorstel bij op GitHub en laat de tests opnieuw lopen.",409)
 // The original source merges only into Main. Production workflows and
 // Production tags are never touched here.
 const merged=await githubMutation("/pulls/"+number+"/merge",key,"PUT",{
  sha:headSha,merge_method:"squash"
 }) as {merged?:boolean;sha?:unknown}
 if(merged.merged!==true||!sha.safeParse(merged.sha).success)
  throw new MakerExecutionError("GitHub heeft de wijziging niet samengevoegd.",409)
 return makerJson({ok:true,sha:merged.sha,
  notice:"Code is samengevoegd naar main-test. Eerst CI main en daarna Deploy main; productie blijft onaangeroerd."})
}
export async function nativeMakerSourcePost(
 db:Pick<SupabaseClient,"rpc">,request:Request,cookies:string,
 env:{SUPABASE_URL:string}
):Promise<Response>{
 try{
  const token=await makerAuthorization(db,request,cookies,env)
  const parsed=action.safeParse(await makerRequestBody(request,1_800_000))
  if(!parsed.success)return makerJson({error:"Ongeldige wijziging."},400)
  const key=await repositoryKey(db,token)
  const value=parsed.data
  if(value.action==="save")return save(key,value)
  if(value.action==="restore")return restore(key,value.target,value.base)
  return publish(key,value.number,value.sha)
 }catch(error){return makerError(error)}
}
