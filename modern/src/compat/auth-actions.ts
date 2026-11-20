import {initialUiLocale} from "@/lib/locale-preferences"

const unavailable={nl:"De aanmeldservice is tijdelijk niet bereikbaar. Probeer opnieuw.",fr:"Le service de connexion est temporairement indisponible. Réessayez.",en:"The sign-in service is temporarily unavailable. Please try again.",de:"Der Anmeldedienst ist vorübergehend nicht erreichbar. Bitte erneut versuchen."}
type Result={error?:string;code?:string;success?:boolean;redirectTo?:string;message?:string}
async function invoke(action:string,form:FormData):Promise<Result>{
 const body=new FormData()
 for(const [key,value] of form)body.append(key,value)
 body.set("_action",action)
 body.set("_callback_origin","https://uptilldawn-modern-main.uptilldawn.workers.dev")
 try{
  const response=await fetch("/api/auth/account-action",{method:"POST",credentials:"same-origin",cache:"no-store",headers:{Accept:"application/json"},body})
  if(!response.ok)throw new Error("AUTH_TRANSPORT_UNAVAILABLE")
  return await response.json() as Result
 }catch{return {error:unavailable[initialUiLocale()],code:"auth_temporarily_unavailable"}}
}
export const signUp=(form:FormData)=>invoke("signUp",form)
export const forgotPassword=(form:FormData)=>invoke("forgotPassword",form)
export const updatePassword=(form:FormData)=>invoke("updatePassword",form)
export const resendVerificationEmail=(form:FormData)=>invoke("resendVerificationEmail",form)
export async function signOut(){
 const result=await invoke("signOut",new FormData())
 if(result.success)window.location.assign("/login")
 else throw new Error(result.code||"signout_failed")
}

// The signed JWT/RLS context is the same source as Main's getCurrentUser.
// No cookie, cached role, form value or user_metadata grants access here.
export async function getCurrentUser(){
 const {createClient}=await import('./crew-client')
 const db=createClient()
 const {data:{session},error:sessionError}=await db.auth.getSession()
 if(sessionError||!session)return null
 type Context=Record<string,unknown>&{id:string;role:string;approved:boolean;account_blocked:boolean;is_owner:boolean;effective_role:string|null;verified_email:string|null}
 const read=db.rpc.bind(db) as unknown as (name:'upt_current_session_context')=>Promise<{data:Context[]|null;error:unknown}>
 const {data,error}=await read('upt_current_session_context'),profile=data?.[0]
 if(error||!profile||profile.id!==session.user.id||!['staff','responsible_lead','admin'].includes(profile.role))return null
 const {verified_email:email,is_owner:owner,effective_role:trustedRole,...publicProfile}=profile
 const isOwner=owner===true
 if((profile.account_blocked||!profile.approved)&&!isOwner)return null
 const realRole=profile.role,realIsAdmin=realRole==='admin'||isOwner
 const stored=realIsAdmin?trustedRole:realRole
 const role=stored==='staff'||stored==='responsible_lead'||stored==='admin'?stored:realRole
 return {...publicProfile,id:profile.id,approved:profile.approved||isOwner,role,realRole,roleMode:role,email:email||'',roles:[role==='staff'?'employee':role],isAdmin:role==='admin',realIsAdmin,isOwner,isEditMode:false}
}
export async function enterNormalAppFromMakerSession(form:FormData){
 const {invokeOriginalAction}=await import('../original/transport')
 return invokeOriginalAction('lib/actions/auth.ts#enterNormalAppFromMakerSession',[form])
}
