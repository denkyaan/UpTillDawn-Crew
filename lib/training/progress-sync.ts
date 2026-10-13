import {createClient} from "@/lib/supabase/crew-client"
import type {TourRole} from "@/lib/tour-training"
import {requiredExerciseIds,type TrainingExerciseResult,type TrainingRecord,trainingReport} from "./completion-policy"

const STAGING="npbjrtiolqperdgljnhi.supabase.co"
function ensureStaging(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL
 if(!url||new URL(url).hostname!==STAGING)throw new Error("Training progress is staging-only")
}
async function authenticated(){
 ensureStaging()
 const client=createClient()
 const {data:{user},error}=await client.auth.getUser()
 if(error||!user)throw new Error("Training progress requires login")
 return {client,user}
}
export async function loadTrainingProgress(scenarioId:string,role:TourRole):Promise<TrainingRecord>{
 const {client,user}=await authenticated()
 const {data,error}=await client.from("training_progress").select("results,updated_at").eq("scenario_id",scenarioId).eq("participant_id",user.id).eq("role",role).maybeSingle()
 if(error)throw error
 const results=(data?.results??{}) as Record<string,TrainingExerciseResult>
 return {participantId:user.id,role,results,questions:[],updatedAt:data?.updated_at??""}
}
export async function saveVerifiedTrainingExercise(scenarioId:string,role:TourRole,id:string,proof:{verified:boolean;error?:string}):Promise<ReturnType<typeof trainingReport>>{
 if(!requiredExerciseIds(role).includes(id))throw new Error("Exercise not permitted for role")
 const {client,user}=await authenticated()
 const {data,error}=await client.from("training_progress").select("results").eq("scenario_id",scenarioId).eq("participant_id",user.id).eq("role",role).maybeSingle()
 if(error)throw error
 const results=(data?.results??{}) as Record<string,TrainingExerciseResult>
 const prior=results[id]
 const now=new Date().toISOString()
 results[id]={id,verified:proof.verified,completedAt:proof.verified?now:"",attempts:(prior?.attempts??0)+1,...(proof.error?{error:proof.error}:{})}
 const {error:writeError}=await client.from("training_progress").upsert({scenario_id:scenarioId,participant_id:user.id,role,results,updated_at:now} as never,{onConflict:"participant_id,scenario_id,role"})
 if(writeError)throw writeError
 return trainingReport({participantId:user.id,role,results,questions:[],updatedAt:now})
}
export async function listTrainingProgressReports(scenarioId:string){
 const {client}=await authenticated()
 const {data,error}=await client.from("training_progress").select("participant_id,role,results,updated_at").eq("scenario_id",scenarioId)
 if(error)throw error
 return (data??[]).map(row=>trainingReport({participantId:row.participant_id,role:row.role as TourRole,results:row.results as Record<string,TrainingExerciseResult>,questions:[],updatedAt:row.updated_at}))
}
