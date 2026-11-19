import {boundedMigrationJson} from '@/lib/migration/bounded-json'
import {integrationServicesForWorkspace} from '@/lib/administration/integration-placement'
import {cookies} from 'next/headers'
import {createClient} from '@/lib/supabase/crew-server'
import {NextResponse} from 'next/server'
import {getCurrentUser} from '@/lib/actions/auth'
import {migrationRequestAllowed} from '@/lib/migration/main-qa-boundary'
import {loadExternalServicesView} from '@/lib/administration/external-services-view-data'
import {externalServicesReadiness} from '@/lib/administration/external-services-readiness'
import {administrationPageAccess} from '@/lib/administration/page-access'
import {checkSigningConnection} from '@/lib/administration/documenso'
import {getArtistSigningDispatchPreflight} from '@/lib/administration/contract-signing-operator-preflight'
export const dynamic='force-dynamic'
const headers={'Cache-Control':'private, no-store'}
const reject=(status:number)=>NextResponse.json({error:'view_data_unavailable'},{status,headers})
/** Only explicitly public view DTOs; this endpoint never serializes env or DB. */
export async function POST(request:Request){
 if(!migrationRequestAllowed(request))return reject(403)
 const user=await getCurrentUser()
 if(!user)return reject(401)
 let body:{id?:string;args?:unknown[]}
 try{body=await boundedMigrationJson(request) as typeof body}catch{return reject(400)}
 if(!body||typeof body!=='object')return reject(400)
 if(!Array.isArray(body.args))return reject(400)
 if(body.id==='god-session-rpc'){
  if(!user.isOwner)return reject(403)
  const fn=body.args[0]
  if(fn!=='upt_god_session_valid'&&fn!=='upt_god_upload_security_audit')return reject(400)
  const token=(await cookies()).get('uptilldawn-god-session')?.value
  if(!token)return NextResponse.json({value:{data:fn==='upt_god_session_valid'?false:[],error:null}},{headers})
  const db=await createClient()
  const result=fn==='upt_god_session_valid'?await db.rpc(fn,{p_token:token}):await db.rpc(fn,{p_token:token,p_limit:200})
  return NextResponse.json({value:{data:result.data,error:result.error?{message:'God Mode-gegevens niet beschikbaar'}:null}},{headers})
 }
 const access=await administrationPageAccess()
 if(!access.ok&&!['external-services','external-services-view'].includes(body.id||''))return reject(access.status)
 try{
  let value:unknown
  if(body.id==='external-services'){
   const workspace=typeof body.args[0]==='string'?body.args[0]:''
   if(!access.ok&&workspace!=='sales')return reject(403)
   value=integrationServicesForWorkspace(workspace,externalServicesReadiness(process.env))
  }
  else if(body.id==='external-services-view'){
   const ids:Set<string>=Array.isArray(body.args[0])?new Set(body.args[0].map(x=>typeof x==='object'&&x!==null&&'id'in x?String(x.id):'')):new Set<string>()
   if(!access.ok&&Array.from(ids).some(id=>!['sumup','eventpay'].includes(id)))return reject(403)
   value=await loadExternalServicesView(externalServicesReadiness(process.env).filter(x=>ids.has(x.id)))
  }else if(body.id==='signing-connection')value=await checkSigningConnection()
  else if(body.id==='artist-signing-preflight'){
   const input=body.args[0] as {bookingId?:string;agreementVersionId?:string}|undefined
   if(!input||![input.bookingId,input.agreementVersionId].every(x=>typeof x==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(x)))return reject(400)
   value=await getArtistSigningDispatchPreflight({bookingId:input.bookingId!,agreementVersionId:input.agreementVersionId!})
  }else return reject(404)
  return NextResponse.json({value},{headers})
 }catch{return reject(503)}
}
