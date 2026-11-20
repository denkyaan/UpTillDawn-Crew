import "server-only"
import {getCurrentUser} from "@/lib/actions/auth"
import {createClient} from "@/lib/supabase/crew-server"
import {requestHasSameOrigin} from "@/lib/request-origin"

/** Resolve permissions from the database on every request, including revoked assignments. */
export async function administrationAccess(){
 const user=await getCurrentUser()
 if(!user)return {ok:false as const,status:401}
 const db=await createClient()
 const {data,error}=await db.rpc("upt_can_manage_administration")
 if(error)return {ok:false as const,status:503}
 if(data!==true)return {ok:false as const,status:403}
 return {ok:true as const,db,user}
}

/** Browser mutations must originate from this application. */
export function sameOrigin(request:Request):boolean{
 return requestHasSameOrigin(request)
}
