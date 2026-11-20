import {supabase} from "./supabase"
import {isActive,parseIdentity} from "../shared/identity"

export const MIGRATION_WRITES_ENABLED=import.meta.env.VITE_MIGRATION_ALLOW_WRITES==="true"
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function requireUuid(id:string):string{
 if(!UUID.test(id))throw new Error("invalid_identifier")
 return id
}
export async function verifyOwnSession():Promise<string>{
 if(!MIGRATION_WRITES_ENABLED)throw new Error("migration_writes_not_enabled")
 const db=supabase()
 const {data:{session},error}=await db.auth.getSession()
 if(error||!session)throw new Error("authentication_required")
 const {data:rows,error:identityError}=await db.rpc("upt_current_session_context")
 const identity=parseIdentity(Array.isArray(rows)?rows[0]:null)
 if(identityError||!identity||!isActive(identity)||identity.id!==session.user.id)
  throw new Error("authorization_failed")
 return identity.id
}

// These are *existing* audited, self-scoped, SECURITY DEFINER RPCs; the
// database re-checks auth.uid(), assignment ownership, shift/event access
// and writes an audit log. No direct table UPDATE from the browser.
export async function confirmOwnTask(assignmentId:string):Promise<void>{
 requireUuid(assignmentId)
 await verifyOwnSession()
 const {error}=await supabase().rpc("upt_confirm_task_assignment",{p_assignment:assignmentId})
 if(error)throw new Error("task_confirmation_rejected")
}
export type TaskStatus="NOT STARTED"|"IN PROGRESS"|"COMPLETED"
export async function updateOwnTaskStatus(assignmentId:string,status:TaskStatus):Promise<void>{
 requireUuid(assignmentId)
 if(!["NOT STARTED","IN PROGRESS","COMPLETED"].includes(status))throw new Error("invalid_task_status")
 await verifyOwnSession()
 const {error}=await supabase().rpc("upt_update_task_status",{p_assignment:assignmentId,p_status:status})
 if(error)throw new Error("task_status_rejected")
}

// Existing chat RPC is atomic and idempotent by the operation UUID.
// A timeout never automatically generates a second operation ID.
export async function sendOwnChatMessage(input:{
 operationId:string;channelId:string;body:string;replyTo?:string|null;
}):Promise<string>{
 requireUuid(input.operationId);requireUuid(input.channelId)
 const body=input.body.trim()
 if(!body||body.length>4000)throw new Error("invalid_message")
 if(input.replyTo)requireUuid(input.replyTo)
 await verifyOwnSession()
 const {data,error}=await supabase().rpc("upt_send_chat_message_operation_v2",{
  p_operation:input.operationId,p_channel:input.channelId,p_body:body,
  p_reply_to:input.replyTo||undefined,p_mention_ids:[],
 })
 if(error||typeof data!=="string")throw new Error("chat_send_rejected")
 return data
}
export async function markOwnChatRead(channelId:string):Promise<void>{
 requireUuid(channelId)
 await verifyOwnSession()
 const {error}=await supabase().rpc("upt_mark_chat_read",{p_channel:channelId})
 if(error)throw new Error("chat_read_rejected")
}
