import {supabase} from "./supabase"

export type ChatMessage={
 id:string;channel_id:string|null;sender_id:string|null;
 body:string|null;created_at:string;moderated_at:string|null;
 reply_to_message_id:string|null
}
export async function loadChannelMessages(channelId:string,signal:AbortSignal):Promise<ChatMessage[]>{
 // RLS via the signed user's JWT; never read a channel with a service key.
 const {data,error}=await supabase().from("messages")
  .select("id,channel_id,sender_id,body,created_at,moderated_at,reply_to_message_id")
  .eq("channel_id",channelId)
  .order("created_at",{ascending:false})
  .limit(100).abortSignal(signal)
 if(error)throw new Error("chat_history_unavailable")
 return ((data||[]) as ChatMessage[]).reverse()
}
