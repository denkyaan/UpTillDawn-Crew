import {MAIN_QA_PROJECT} from "../../../lib/migration/main-auth-runtime-config.ts"
import type {MainAuthBindings} from "./main-auth.ts"
import {nativeRuntimeScope} from "./runtime-scope.ts"

// Only configuration, never an HTTP proxy, user identity, address or mail key.
export async function resolveMainGeoapifyKey(env:Omit<MainAuthBindings,"MAIN_AUTH">):Promise<string>{
 if(!nativeRuntimeScope(env))throw Error("invalid_main_configuration")
 const local=env.GEOAPIFY_API_KEY?.trim()
 if(local)return local
 if(env.UPT_MIGRATION_NATIVE_AUTH_ENABLED==="true")return ""
 const binding=env.MAIN_AUTH_RUNTIME
 if(!binding?.geoapifyConfiguration)return ""
 const config=await binding.geoapifyConfiguration()
 if(config.protocol!=="main-geoapify-native-v1"||config.projectUrl!==MAIN_QA_PROJECT||typeof config.key!=="string")
  throw Error("invalid_main_configuration")
 return config.key.trim()
}
