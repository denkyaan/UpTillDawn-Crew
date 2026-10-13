import {createClient} from "@/lib/supabase/crew-client"
import type {TourRole} from "@/lib/tour-training"
const STAGING="npbjrtiolqperdgljnhi"
function assertStaging(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL
 if(!url||new URL(url).hostname!==STAGING+".supabase.co")throw new Error("Training questions are staging-only")
}
async function session(){
 assertStaging()
 const client=createClient()
 const {data:{user},error}=await client.auth.getUser()
 if(error||!user)throw new Error("Sign in to access training questions")
 return {client,user}
}
export async function sendTrainingQuestion(scenarioId:string,role:TourRole,question:string){
 const {client,user}=await session()
 const message=question.trim()
 if(!message||message.length>4000)throw new Error("Question must contain 1–4000 characters")
 const {error}=await client.from("training_questions").insert({scenario_id:scenarioId,participant_id:user.id,role,question:message} as never)
 if(error)throw error
}
export async function listTrainingQuestions(scenarioId:string){
 const {client}=await session()
 const {data,error}=await client.from("training_questions").select("id,participant_id,role,question,answer,status,created_at,answered_at").eq("scenario_id",scenarioId).order("created_at",{ascending:false})
 if(error)throw error
 return data
}
export async function answerTrainingQuestion(id:string,answer:string,status:"answered"|"closed"="answered"){
 const {client}=await session()
 const message=answer.trim()
 if(!message||message.length>4000)throw new Error("Answer must contain 1–4000 characters")
 const {error}=await client.from("training_questions").update({answer:message,status,answered_at:new Date().toISOString()} as never).eq("id",id)
 if(error)throw error
}
