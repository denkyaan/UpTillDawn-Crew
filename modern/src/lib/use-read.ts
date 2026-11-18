import {useEffect,useRef,useState} from "react"
import {readSnapshot,writeSnapshot} from "./local-cache"

type CachedKind="events"|"tasks"|"chat-list"
type DataState<T>={scope:string;data:T|null;loading:boolean;stale:boolean;error:string|null}
export function useRead<T>(uid:string,kind:CachedKind,load:(signal:AbortSignal)=>Promise<T>){
 const scope=uid+":"+kind
 const [state,setState]=useState<DataState<T>>({scope,data:null,loading:true,stale:false,error:null})
 const loader=useRef(load)
 loader.current=load
 const [refreshToken,setRefreshToken]=useState(0)
 useEffect(()=>{
  let cancelled=false
  const controller=new AbortController()
  const timer=setTimeout(()=>controller.abort(),12_000)
  setState({scope,data:null,loading:true,stale:false,error:null})
  void readSnapshot<T>(uid,kind).then(saved=>{
   if(!cancelled&&saved!==null)setState(current=>current.scope===scope&&current.data===null?{scope,data:saved,loading:true,stale:true,error:null}:current)
  }).catch(()=>{})
  void loader.current(controller.signal).then(data=>{
   if(cancelled)return
   setState({scope,data,loading:false,stale:false,error:null})
   void writeSnapshot(uid,kind,data).catch(()=>{})
  }).catch(()=>{
   if(!cancelled)setState(current=>current.scope===scope?{...current,loading:false,error:"data_unavailable"}:current)
  }).finally(()=>clearTimeout(timer))
  return()=>{cancelled=true;clearTimeout(timer);controller.abort()}
 },[uid,kind,refreshToken])
 // Never render a previous user\'s snapshot, even for one paint before effects run.\n const visible=state.scope===scope?state:{scope,data:null,loading:true,stale:false,error:null}\n return {...visible,refresh:()=>setRefreshToken(x=>x+1)}
}
