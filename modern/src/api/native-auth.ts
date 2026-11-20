import {executeOriginalAuth} from './native-auth.generated.mjs'
import {NextRequest,NextResponse,cookies,withNativeAuth} from './native-auth-context.ts'
import {MAIN_AUTH_PRIVATE_ENV_KEYS,MAIN_QA_PROJECT} from '../../../lib/migration/main-auth-runtime-config.ts'
export type MainAuthRuntimeBinding={runtimeConfiguration:()=>Promise<{protocol:string;projectUrl:string;values:Record<string,unknown>}>}
export async function nativeOriginalAuth(request:Request,binding:MainAuthRuntimeBinding,publishableKey:string):Promise<Response>{
 const config=await binding.runtimeConfiguration()
 if(config.protocol!=='main-auth-native-v1'||config.projectUrl!==MAIN_QA_PROJECT)throw Error('Invalid native authentication environment')
 const env:Record<string,string|undefined>={NODE_ENV:'production',NEXT_PUBLIC_APP_URL:'https://uptilldawn-main.uptilldawn.workers.dev',NEXT_PUBLIC_SUPABASE_URL:MAIN_QA_PROJECT,NEXT_PUBLIC_SUPABASE_ANON_KEY:publishableKey}
 for(const name of MAIN_AUTH_PRIVATE_ENV_KEYS){const value=config.values[name];if(typeof value==='string')env[name]=value}
 return withNativeAuth(request,env,async()=>{
  const result=await executeOriginalAuth(new NextRequest(request))
  const output=new Headers(result.headers)
  ;(await cookies()).appendTo(output)
  if(result instanceof NextResponse)result.cookies.appendTo(output)
  output.set('X-UpTillDawn-Auth-Runtime','native-original-source')
  return new Response(result.body,{status:result.status,statusText:result.statusText,headers:output})
 })
}
