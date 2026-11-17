import "server-only"
import {cache} from "react"
import {administrationPageAccess} from "@/lib/administration/page-access"

/**
 * Business integration ownership belongs to the designated organizational Head
 * and approved Administration staff. Being a Maker/technical Owner alone does
 * not grant access to bank, payment or signing credentials.
 */
// React request-local caching deduplicates permission RPCs across Banking,
// integration cards and the same SSR request. Never cache across users.
export const integrationManagementAccess=cache(async function integrationManagementAccess(){
 const access=await administrationPageAccess()
 if(!access.ok)return access
 const invoke=access.db.rpc.bind(access.db) as unknown as (name:string)=>Promise<{data:unknown;error:unknown}>
 const {data,error}=await invoke("upt_can_manage_integrations")
 if(error)return {ok:false as const,status:503}
 if(data!==true)return {ok:false as const,status:403}
 return access
})
