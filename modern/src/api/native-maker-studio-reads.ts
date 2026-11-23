// Original read-only Maker Studio endpoints without an expensive Next/SSR hop.
// Never expose private GitHub or Supabase Management credentials to the browser.
// The signed QA session AND the separate short-lived God Mode cookie are needed.
import {parseCookieHeader} from "@supabase/ssr"
import {z} from "zod"
import type {SupabaseClient} from "@supabase/supabase-js"
import {editablePath,MAX_SOURCE_BYTES,shaSchema,sourcePath,STUDIO_REPOSITORY}
 from "../../../lib/god-studio.ts"
import {nativeMakerOverviewResponse} from "./native-maker-overview.ts"

export type NativeMakerStudioPath="/api/god/source"|"/api/god/sql"|"/api/god/overview"
type Db=Pick<SupabaseClient,"rpc">
type Env={SUPABASE_URL:string}
const QA_DATABASE="https://npbjrtiolqperdgljnhi.supabase.co"
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{
 "Cache-Control":"no-store","X-Content-Type-Options":"nosniff"
}})
class StudioError extends Error{
 status:number
 constructor(message:string,status=400){super(message);this.status=status}
}
const generic="De actie kon niet worden voltooid. Vernieuw de status voordat je opnieuw opslaat."
function invalidOrigin(request:Request){
 const site=request.headers.get("sec-fetch-site")
 const origin=request.headers.get("origin")
 return site==="cross-site"||Boolean(origin&&origin!==new URL(request.url).origin)
}
async function godToken(db:Db,request:Request,cookies:string,env:Env){
 if(env.SUPABASE_URL!==QA_DATABASE)
  throw new StudioError("God Mode is not configured for a recognized environment.",503)
 if(invalidOrigin(request))throw new StudioError("Ongeldige oorsprong.",403)
 const token=parseCookieHeader(cookies).find(x=>x.name==="uptilldawn-god-session")?.value
 if(!token)throw new StudioError("Meld opnieuw aan bij God Mode.",401)
 const {data,error}=await db.rpc("upt_god_session_valid",{p_token:token})
 if(error||data!==true)throw new StudioError("God Mode sessie verlopen.",401)
 return token
}
function denied(status:number){
 const messages:Record<number,string>={
 401:"De GitHub-sleutel is ongeldig of verlopen.",
 403:"GitHub weigert deze actie. Controleer de repositoryrechten en API-limiet.",
 404:"GitHub-bestand, workflow of toegangsrecht ontbreekt.",
 409:"De broncode is intussen gewijzigd. Laad de nieuwste versie.",
 422:"GitHub kon de wijziging niet toepassen. Controleer de bestanden en branch."
 }
 throw new StudioError(messages[status]||"GitHub is tijdelijk niet beschikbaar ("+status+").",
  status===401||status===403?403:409)
}
export async function makerBoundedJson(response:Response,limit=6_000_000):Promise<unknown>{
 const length=response.headers.get("content-length")
 if(length&&Number(length)>limit)throw new StudioError("GitHub-resultaat is te groot.",413)
 if(!response.body)throw new StudioError("GitHub gaf geen bruikbaar antwoord.",502)
 const chunks:Uint8Array[]=[];let size=0
 const reader=response.body.getReader()
 try{
  for(;;){
   const {done,value}=await reader.read()
   if(done)break
   size+=value.byteLength
   if(size>limit){await reader.cancel().catch(()=>{});throw new StudioError("GitHub-resultaat is te groot.",413)}
   chunks.push(value)
  }
 }finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
 try{return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes))}
 catch{throw new StudioError("GitHub gaf geen bruikbaar antwoord.",502)}
}
export async function makerGithubRead(path:string,credential?:string){
 // The endpoint is a literal repository allowlist, never a user-supplied URL.
 if(!path.startsWith("/")||path.includes("..")||/[\r\n]/.test(path))
  throw new StudioError("Ongeldig repositorypad.")
 const response=await fetch("https://api.github.com/repos/"+STUDIO_REPOSITORY+path,{
  headers:{
   Accept:"application/vnd.github+json",
   "X-GitHub-Api-Version":"2022-11-28",
   "User-Agent":"UpTillDawn-GodMode",
   ...(credential?{Authorization:"Bearer "+credential}:{})
  },
  cache:"no-store",redirect:"manual",signal:AbortSignal.timeout(20_000)
 })
 if(!response.ok)denied(response.status)
 return makerBoundedJson(response)
}
type Tree={sha:string;truncated?:boolean;tree:Array<{path:string;type:string;mode:string;sha:string;size?:number}>}
const shaValue=(input:unknown)=>shaSchema.parse(input)
function textFromBase64(value:string){
 try{
  // Decode once, with strict UTF-8; no Node Buffer/Next polyfill required.
  const ascii=atob(value.replace(/\s/g,""))
  const bytes=Uint8Array.from(ascii,character=>character.charCodeAt(0))
  return new TextDecoder("utf-8",{fatal:true}).decode(bytes)
 }catch{throw new StudioError("Het bronbestand kon niet veilig worden gelezen.",422)}
}
async function sourceRead(db:Db,token:string,request:Request){
 const {data:secret}=await db.rpc("upt_god_repository_secret",{p_token:token})
 const credential=typeof secret==="string"&&secret?secret:undefined
 const params=new URL(request.url).searchParams
 const action=params.get("action")||"tree"
 if(action==="tree"){
  const head=shaValue((await makerGithubRead("/git/ref/heads/main",credential) as {object?:{sha?:string}}).object?.sha)
  const tree=await makerGithubRead("/git/trees/"+head+"?recursive=1",credential) as Tree
  if(!tree||!Array.isArray(tree.tree))throw new StudioError("De repository kon niet worden geladen.",503)
  if(tree.truncated)throw new StudioError("De repository is te groot om volledig te laden.",413)
  return reply({head,connected:Boolean(credential),repository:STUDIO_REPOSITORY,
   files:tree.tree.filter(item=>item?.type==="blob"&&editablePath(item.path))})
 }
 if(action==="file"){
  let path:string,ref:string
  try{path=sourcePath.parse(params.get("path"));ref=shaSchema.parse(params.get("ref"))}
  catch{return reply({error:"Ongeldige bestandsaanvraag."},400)}
  const data=await makerGithubRead("/contents/"+path.split("/").map(encodeURIComponent).join("/")+"?ref="+ref,
   credential) as {content?:unknown;encoding?:unknown;sha?:unknown;size?:unknown}
  if(typeof data.size!=="number"||data.size>MAX_SOURCE_BYTES||data.encoding!=="base64"||
     typeof data.content!=="string")throw new StudioError("Dit bestand is te groot voor de ingebouwde teksteditor.",413)
  return reply({path,sha:shaValue(data.sha),content:textFromBase64(data.content)})
 }
 if(action==="history"){
  const [commits,pulls]=await Promise.all([
   makerGithubRead("/commits?sha=main&per_page=30",credential),
   makerGithubRead("/pulls?state=open&per_page=100",credential)
  ])
  if(!Array.isArray(commits)||!Array.isArray(pulls))
   throw new StudioError("De versiegeschiedenis kon niet worden geladen.",503)
  return reply({commits,pulls:pulls.filter(p=>{
   if(!p||typeof p!=="object")return false
   const head=(p as {head?:{ref?:string;repo?:{full_name?:string}}}).head
   return head?.repo?.full_name===STUDIO_REPOSITORY&&
    typeof head?.ref==="string"&&head.ref.startsWith("god-mode/")
  })})
 }
 if(action==="checks"){
  let sha:string
  try{sha=shaValue(params.get("sha"))}
  catch{return reply({error:"Ongeldige bestandsaanvraag."},400)}
  const data=await makerGithubRead("/actions/runs?head_sha="+sha+"&per_page=100",credential) as {workflow_runs?:unknown}
  if(!Array.isArray(data?.workflow_runs))
   throw new StudioError("De CI-resultaten konden niet worden geladen.",503)
  const runs=data.workflow_runs.map((value:unknown)=>{
   const r=value as Record<string,unknown>
   return {id:r.id,name:r.name,path:r.path,head_sha:r.head_sha,status:r.status,
    conclusion:r.conclusion,html_url:r.html_url,run_attempt:r.run_attempt}
  })
  return reply({runs})
 }
 throw new StudioError("Onbekende actie.")
}
async function sqlRead(db:Db,token:string){
 const {data,error}=await db.rpc("upt_god_database_secret",{p_token:token})
 if(error)throw new StudioError("Databasekoppeling niet beschikbaar.",503)
 // Same original read DTO, no query execution and no private value in response.
 return reply({connected:Boolean(data),environment:"main",environments:["main","production"]})
}
export async function nativeMakerStudioReadResponse(
 db:Db,request:Request,cookies:string,env:Env,path:NativeMakerStudioPath
):Promise<Response>{
 try{
  const token=await godToken(db,request,cookies,env)
  return path==="/api/god/sql"?await sqlRead(db,token):
   path==="/api/god/overview"?await nativeMakerOverviewResponse(db,token,request):
   await sourceRead(db,token,request)
 }catch(error){
  return error instanceof z.ZodError?reply({error:"Ongeldige bestandsaanvraag."},400):
   error instanceof StudioError?reply({error:error.message},error.status):
   reply({error:generic},500)
 }
}
