import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database} from '../../../types/crew-database'
import {supabase} from '../lib/supabase'
import {invokeOriginalRead} from '../original/transport'
let client:SupabaseClient<Database>|undefined
export function createClient(){
 if(client)return client
 const db=supabase() as SupabaseClient<Database>
 client=new Proxy(db,{get(target,name){
  if(name==='rpc')return (fn:string,args?:Record<string,unknown>,options?:unknown)=>{
   if(['upt_god_session_valid','upt_god_upload_security_audit'].includes(fn)&&args?.p_token==='server-managed-god-session')return invokeOriginalRead('god-session-rpc',[fn]).catch(()=>({data:null,error:{message:'God Mode-gegevens niet beschikbaar'}}))
   return (target.rpc as (...args:unknown[])=>unknown).call(target,fn,args,options)
  }
  return Reflect.get(target,name,target)
 }})
 return client
}
