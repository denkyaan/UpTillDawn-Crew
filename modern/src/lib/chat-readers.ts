import {supabase} from "./supabase"
import {withReadBudget} from "./request-budget"

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export type ChatReader={user_id:string;full_name:string;read_at:string}
export async function loadMessageReaders(messageId:string,signal:AbortSignal):Promise<ChatReader[]>{
 if(!UUID.test(messageId))throw new Error("invalid_message_id")
 // Existing security-definer function checks signed auth.uid() AND live
 // upt_can_read_channel. No unauthenticated Worker or privileged key.
 const {data,error}=await withReadBudget(signal,()=>
  Promise.resolve(supabase().rpc("upt_chat_message_readers",{p_message:messageId}).abortSignal(signal))
 )
 if(error||!Array.isArray(data))throw new Error("chat_readers_unavailable")
 return data.slice(0,100).filter((row:unknown):row is Record<string,unknown>=>
  Boolean(row)&&typeof row==="object"&&!Array.isArray(row)
  &&typeof (row as Record<string,unknown>).user_id==="string"
  &&UUID.test(String((row as Record<string,unknown>).user_id))
  &&typeof (row as Record<string,unknown>).full_name==="string"
  &&typeof (row as Record<string,unknown>).read_at==="string"
 ).map(row=>({user_id:String(row.user_id),full_name:String(row.full_name).slice(0,120),read_at:String(row.read_at)}))
}
