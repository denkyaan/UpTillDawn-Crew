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
