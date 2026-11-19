import {supabase} from "./supabase"

// Only explicit user interaction invokes the Hono Worker. No periodic
// polling, background session writes or credentials persisted in local storage.
export async function protectedCandidateGet<T>(path:"/api/v1/god/diagnostics"|"/api/v1/integrations/status"):Promise<T>{
 const {data:{session},error}=await supabase().auth.getSession()
 if(error||!session?.access_token)throw new Error("authentication_required")
 const controller=new AbortController()
 const timeout=setTimeout(()=>controller.abort(),12000)
 try{
  const response=await fetch(path,{
   headers:{Authorization:"Bearer "+session.access_token,Accept:"application/json"},
   credentials:"omit",cache:"no-store",redirect:"error",signal:controller.signal
  })
  if(!response.ok)throw new Error(response.status===403?"access_denied":"service_unavailable")
  const length=response.headers.get("content-length")
  if(length&&Number(length)>45000)throw new Error("oversized_response")
  const json:unknown=await response.json()
  if(json===null||typeof json!=="object"||Array.isArray(json))throw new Error("invalid_response")
  return json as T
 }finally{clearTimeout(timeout)}
}
