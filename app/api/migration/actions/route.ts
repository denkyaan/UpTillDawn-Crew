import {NextResponse} from 'next/server'
import {isRedirectError} from 'next/dist/client/components/redirect-error'
import {getCurrentUser} from '@/lib/actions/auth'
import {originalActions} from '@/lib/migration/original-action-registry'
import {migrationRequestAllowed} from '@/lib/migration/main-qa-boundary'
import {boundedMigrationForm} from '@/lib/migration/bounded-form'
import {encode,decode} from '@/lib/migration/wire'
export const dynamic='force-dynamic'
const headers={'Cache-Control':'private, no-store'}
const reject=(status:number,code:string)=>NextResponse.json({error:'De actie kon niet worden uitgevoerd. Probeer opnieuw.',code},{status,headers})

/** Execute the unchanged, statically selected Main action. Its own validation,
 * authorization, RLS, audit and revalidation remain the authority. QA only. */
export async function POST(request:Request){
 if(!migrationRequestAllowed(request))return reject(403,'migration_disabled')
 if(!await getCurrentUser())return reject(401,'authentication_required')
 if(!(request.headers.get('content-type')||'').startsWith('multipart/form-data;'))return reject(415,'invalid_content_type')
 let form:FormData
 try{form=await boundedMigrationForm(request)}catch{return reject(413,'invalid_form')}
 const id=form.get('_id'),payload=form.get('_args')
 if(typeof id!=='string'||!Object.hasOwn(originalActions,id))return reject(404,'unknown_action')
 if(typeof payload!=='string'||payload.length>1024*1024)return reject(413,'invalid_arguments')
 let args:unknown
 try{args=decode(JSON.parse(payload),form)}catch{return reject(400,'invalid_arguments')}
 if(!Array.isArray(args)||args.length>20)return reject(400,'invalid_arguments')
 try{
  const action=await originalActions[id]()
  const result=await action(...args)
  const files=new FormData(),value=encode(result,files)
  if(Array.from(files.keys()).length)return reject(500,'unsupported_response')
  return NextResponse.json({value,refresh:true},{headers})
 }catch(error){
  if(isRedirectError(error)){
   const target=error.digest.split(';').slice(2,-2).join(';')
   const url=new URL(target,'https://uptilldawn-main.uptilldawn.workers.dev')
   if(url.origin==='https://uptilldawn-main.uptilldawn.workers.dev')return NextResponse.json({redirect:url.pathname+url.search+url.hash},{headers})
  }
  return reject(422,'action_failed')
 }
}
