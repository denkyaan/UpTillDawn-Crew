import {authRequestOrigin} from '@/lib/request-origin'
import {NextRequest,NextResponse} from 'next/server'
import {isRedirectError} from 'next/dist/client/components/redirect-error'
import {signUp,forgotPassword,updatePassword,resendVerificationEmail,signOut} from '@/lib/actions/auth'
import {readBoundedFormData} from '@/lib/bounded-form-data'

export const dynamic='force-dynamic'
const NO_STORE={'Cache-Control':'private, no-store'} as const
const actions={signUp,forgotPassword,updatePassword,resendVerificationEmail} as const
function reject(status:number,code:string){return NextResponse.json({error:'De aanvraag kon niet worden verwerkt.',code},{status,headers:NO_STORE})}

// A bounded JSON transport for the SAME existing account server actions. No
// alternate password, approval, verification or recovery implementation.
export async function POST(request:NextRequest){
 if(!authRequestOrigin(request,process.env.NEXT_PUBLIC_APP_URL))return reject(403,'invalid_origin')
 if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('multipart/form-data;'))return reject(415,'invalid_content_type')
 let form:FormData
 try{form=await readBoundedFormData(request,16_384)}
 catch(error){return reject(error instanceof Error&&error.message==='too_large'?413:400,'invalid_form')}
 const action=String(form.get('_action')||'')
 if(action!=='signOut'&&!Object.hasOwn(actions,action))return reject(400,'invalid_action')
 for(const [,value] of form)if(typeof value!=='string'||value.length>2048)return reject(413,'invalid_form')
 // A separate host must receive its own PKCE callback and verifier cookie.
 // Until that exact Supabase QA redirect is configured AND tested, do not
 // send recovery/signup email that silently falls back to a different host.
 if(form.get('_callback_origin')==='https://uptilldawn-modern-main.uptilldawn.workers.dev'&&
    ['signUp','forgotPassword','resendVerificationEmail'].includes(action)&&
    process.env.UPT_MIGRATION_EMAIL_CALLBACK_READY!=='true')return reject(503,'email_callback_not_verified')
 try{
  if(action==='signOut'){
   try{await signOut()}
   catch(error){if(!isRedirectError(error))throw error}
   return NextResponse.json({success:true,redirectTo:'/login'},{headers:NO_STORE})
  }
  return NextResponse.json(await actions[action as keyof typeof actions](form),{headers:NO_STORE})
 }catch{return reject(503,'auth_temporarily_unavailable')}
}
