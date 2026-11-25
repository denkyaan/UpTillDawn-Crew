import {executeOriginalAuth} from './native-auth.generated.mjs'
import {NextRequest,NextResponse,cookies,withNativeAuth} from './native-auth-context.ts'
import {MAIN_AUTH_PRIVATE_ENV_KEYS,MAIN_QA_PROJECT} from '../../../lib/migration/main-auth-runtime-config.ts'
import {isNativeAuthProject,MAIN_ORIGIN} from './runtime-scope.ts'
export type MainAuthRuntimeBinding={
 runtimeConfiguration:()=>Promise<{protocol:string;projectUrl:string;values:Record<string,unknown>}>
 geoapifyConfiguration?:()=>Promise<{protocol:string;projectUrl:string;key:string}>
}
export async function nativeOriginalAuth(request:Request,binding:MainAuthRuntimeBinding,publishableKey:string,
 scope:{appOrigin:string;projectUrl:string}={appOrigin:MAIN_ORIGIN,projectUrl:MAIN_QA_PROJECT}
):Promise<Response>{
 if(!isNativeAuthProject(scope.appOrigin,scope.projectUrl)||new URL(request.url).origin!==scope.appOrigin)
  throw Error('Invalid native authentication scope')
 const config=await binding.runtimeConfiguration()
 if(config.protocol!=='main-auth-native-v1'||config.projectUrl!==scope.projectUrl)throw Error('Invalid native authentication environment')
 const env:Record<string,string|undefined>={NODE_ENV:'production',NEXT_PUBLIC_APP_URL:scope.appOrigin,NEXT_PUBLIC_SUPABASE_URL:scope.projectUrl,NEXT_PUBLIC_SUPABASE_ANON_KEY:publishableKey}
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
