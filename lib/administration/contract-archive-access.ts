import "server-only"
import {createClient} from "@/lib/supabase/crew-server"
import {getCurrentUser} from "@/lib/actions/auth"
import {canOpenPortal,type PortalAssignment} from "@/lib/portal-access"
import type {ArchiveStorageClient} from "./contract-archive-server"

/**
 * Return a session-bound storage client only after checking administration access.
 * Storage RLS must independently permit the operation; this is not a privilege bypass.
 */
export async function authorizedContractStorage():Promise<ArchiveStorageClient>{
 const user=await getCurrentUser()
 if(!user||(!user.approved&&!user.isOwner)||(user.account_blocked&&!user.isOwner))throw new Error("Contract archive access denied")
 const db=await createClient()
 if(!user.isAdmin&&!user.isOwner){
  const {data,error}=await db.rpc("upt_my_portal_assignments")
  if(error||!canOpenPortal("administration",(data??[]) as PortalAssignment[],{
   approved:user.approved,blocked:Boolean(user.account_blocked)
  }))throw new Error("Contract archive access denied")
 }
 return db
}
