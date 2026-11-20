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

// User-triggered only: allowlisted OAuth actions. Strictly same-origin and
// signed Supabase JWT; cookies contain ONLY HMAC-bound one-time OAuth state.
// No bearer token, provider secret or OAuth code is persisted in browser storage.
export async function protectedCandidatePost<T>(
 path:"/api/v1/integrations/oauth/start"|"/api/v1/integrations/oauth/complete",
 body:Record<string,string>
):Promise<T>{
 const {data:{session},error}=await supabase().auth.getSession()
 if(error||!session?.access_token)throw new Error("authentication_required")
 const controller=new AbortController()
 const timeout=setTimeout(()=>controller.abort(),16000)
 try{
  const response=await fetch(path,{
   method:"POST",credentials:"include",mode:"same-origin",
   headers:{Authorization:"Bearer "+session.access_token,
    "Content-Type":"application/json","Accept":"application/json"},
   body:JSON.stringify(body),cache:"no-store",redirect:"error",
   referrerPolicy:"no-referrer",signal:controller.signal
  })
  if(!response.ok)throw new Error(response.status===403?"access_denied":
   response.status===409?"oauth_not_ready":"provider_unavailable")
  const length=response.headers.get("content-length")
  if(length&&Number(length)>8000)throw new Error("oversized_response")
  const json:unknown=await response.json()
  if(!json||typeof json!=="object"||Array.isArray(json))throw new Error("invalid_response")
  return json as T
 }finally{clearTimeout(timeout)}
}
