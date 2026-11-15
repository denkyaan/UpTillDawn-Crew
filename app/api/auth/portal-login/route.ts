import {NextRequest,NextResponse} from 'next/server'
import {signIn} from '@/lib/actions/auth'

export const dynamic='force-dynamic'
const NO_STORE={'Cache-Control':'private, no-store'} as const

function reject(status:number,code:string){
 return NextResponse.json({error:'Aanmelden kon niet worden verwerkt.',code},
  {status,headers:NO_STORE})
}

/** Dedicated POST transport for build-time public login HTML.
 * The existing server action owns all password, approval, Maker/role,
 * portal assignment, security notification and Supabase cookie logic.
 * No service_role key or authorization decision is ever exposed here.
 */
export async function POST(request:NextRequest){
 const origin=request.headers.get('origin')
 const expected=new URL(request.url).origin
 const fetchSite=request.headers.get('sec-fetch-site')
 if(origin!==expected||(fetchSite&&fetchSite!=='same-origin'))
  return reject(403,'invalid_origin')
 const contentType=request.headers.get('content-type')||''
 if(!contentType.toLowerCase().startsWith('multipart/form-data;'))
  return reject(415,'invalid_content_type')
 const length=Number(request.headers.get('content-length')||0)
 if(!Number.isFinite(length)||length>16_384)return reject(413,'form_too_large')

 try{
  const form=await request.formData()
  const portal=String(form.get('portal')??'')
  if(!['staff','responsible','promotion','administration'].includes(portal))
   return reject(403,'invalid_portal')
  const username=String(form.get('email')??'')
  const password=String(form.get('password')??'')
  if(username.length>320||password.length>1024)return reject(413,'form_too_large')
  // Server-side authorization remains a single source of truth.
  const result=await signIn(form)
  return NextResponse.json(result,{headers:NO_STORE})
 }catch{
  return reject(503,'login_temporarily_unavailable')
 }
}
