// Original God Mode SQL connection/query actions, isolated from Next.js.
// Every POST is already denied by the public QA write gate in worker.ts.
// Even when enabled in a private acceptance test, production SQL writes are
// prohibited from this Main-QA principal.
import {z} from "zod"
import type {SupabaseClient} from "@supabase/supabase-js"
import {makerBoundedJson} from "./native-maker-studio-reads.ts"
import {makerAuthorization,makerRequestBody,makerJson,makerError,MakerExecutionError} from "./native-maker-execution-guard.ts"

const command=z.discriminatedUnion("action",[
 z.object({action:z.literal("connect"),credential:z.string().trim().min(20).max(500)}).strict(),
 z.object({action:z.literal("disconnect")}).strict(),
 z.object({action:z.literal("query"),query:z.string().trim().min(1).max(100000),
  write:z.boolean(),environment:z.enum(["main","production"]).optional(),
  productionConfirmation:z.string().optional()}).strict()
])
const targets={main:"npbjrtiolqperdgljnhi",production:"eakoavcieossazqzplke"} as const
type Target=keyof typeof targets

async function managementQuery(credential:string,query:string,readOnly:boolean,target:Target){
 const response=await fetch("https://api.supabase.com/v1/projects/"+targets[target]+"/database/query",{
  method:"POST",headers:{Authorization:"Bearer "+credential,"Content-Type":"application/json"},
  body:JSON.stringify({query,read_only:readOnly}),cache:"no-store",
  redirect:"manual",signal:AbortSignal.timeout(30_000)
 })
 if(!response.ok){
  if(response.status===401||response.status===403)
   throw new MakerExecutionError("De Supabase-beheersleutel heeft geen databasebevoegdheid in deze omgeving.",400)
  throw new MakerExecutionError("SQL mislukt: de beheer-API heeft de aanvraag geweigerd.",400)
 }
 return makerBoundedJson(response,1_500_000)
}
export async function nativeMakerSqlPost(
 db:Pick<SupabaseClient,"rpc">,request:Request,cookies:string,env:{SUPABASE_URL:string}
):Promise<Response>{
 try{
  const token=await makerAuthorization(db,request,cookies,env)
  const parsed=command.safeParse(await makerRequestBody(request,130_000))
  if(!parsed.success)return makerJson({error:"Ongeldige SQL-aanvraag."},400)
  const value=parsed.data
  if(value.action==="connect"){
   await managementQuery(value.credential,"select current_database() as database",true,"main")
   const {error}=await db.rpc("upt_god_database_connect",{p_token:token,p_secret:value.credential})
   if(error)throw new MakerExecutionError("Koppeling opslaan mislukt.",503)
   return makerJson({ok:true,environment:"main"})
  }
  if(value.action==="disconnect"){
   const {error}=await db.rpc("upt_god_database_disconnect",{p_token:token})
   if(error)throw new MakerExecutionError("Ontkoppelen mislukt.",503)
   return makerJson({ok:true})
  }
  const target=value.environment||"main"
  if(value.write&&target!=="main")
   throw new MakerExecutionError("Schrijfopdrachten moeten vanuit de apart aangemelde omgeving zelf gebeuren.",403)
  // A separate private safety switch prevents an accidental SQL write in
  // the migration acceptance environment even if an unrelated write flag is
  // mistakenly flipped. Original production SQL can never be written here.
  if(value.write&&
    (env as {UPT_MIGRATION_SQL_WRITES_ENABLED?:string}).UPT_MIGRATION_SQL_WRITES_ENABLED!=="true")
   throw new MakerExecutionError("SQL-schrijfacties zijn in deze testomgeving uitgeschakeld.",403)
  const {data:credential,error}=await db.rpc("upt_god_database_secret",{p_token:token})
  if(error||typeof credential!=="string"||!credential)
   throw new MakerExecutionError("Koppel een Supabase Management API-token in Koppelingen.",428)
  return makerJson({environment:target,data:await managementQuery(
   credential,value.query,!value.write,target
  )})
 }catch(error){return makerError(error)}
}
