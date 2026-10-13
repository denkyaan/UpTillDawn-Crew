import {createClient} from "@/lib/supabase/crew-client"

const KEY="uptilldawn-training-workflow-v3"
const STAGING_REF="npbjrtiolqperdgljnhi"

function stagingOnly(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL
  if(!url || new URL(url).hostname!==STAGING_REF+".supabase.co") throw new Error("Training sync is staging-only")
}

export async function saveOwnedTrainingScenario(payload:Record<string,unknown>){
  stagingOnly()
  const client=createClient()
  const {data:{user},error:authError}=await client.auth.getUser()
  if(authError||!user) throw new Error("Training sync requires login")
  const {error}=await client.from("training_scenarios").upsert({owner_id:user.id,name:"Training scenario",payload,updated_at:new Date().toISOString()} as never,{onConflict:"owner_id"})
  if(error) throw error
}

export async function loadOwnedTrainingScenario(){
  stagingOnly()
  const client=createClient()
  const {data:{user},error:authError}=await client.auth.getUser()
  if(authError||!user) throw new Error("Training sync requires login")
  const {data,error}=await client.from("training_scenarios").select("payload").eq("owner_id",user.id).maybeSingle()
  if(error) throw error
  const payload=(data as {payload?:unknown}|null)?.payload
  if(!payload || typeof payload!=="object" || Array.isArray(payload)) return null
  return payload as Record<string,unknown>
}

export async function syncBrowserTrainingScenario(){
  const payload=JSON.parse(sessionStorage.getItem(KEY)||"{}") as Record<string,unknown>
  await saveOwnedTrainingScenario(payload)
}
