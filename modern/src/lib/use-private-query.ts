import {withReadBudget} from "./request-budget"
import {useEffect,useRef,useState} from "react"

// Strictly ephemeral state for personal/financial/incident details.
// Never put these in IndexedDB or a shared service-worker cache.
type State<T>={scope:string;data:T|null;loading:boolean;error:string|null}
export function usePrivateQuery<T>(
 userId:string,key:string,
 load:(signal:AbortSignal)=>Promise<T>,
){
 const scope=userId+":"+key
 const loader=useRef(load);loader.current=load
 const [retry,setRetry]=useState(0)
 const [state,setState]=useState<State<T>>({scope,data:null,loading:true,error:null})
 useEffect(()=>{
  let mounted=true
  const controller=new AbortController()
  const deadline=setTimeout(()=>controller.abort(),12000)
  setState({scope,data:null,loading:true,error:null})
  void withReadBudget(controller.signal,()=>loader.current(controller.signal))
   .then(data=>{if(mounted)setState({scope,data,loading:false,error:null})})
   .catch(()=>{if(mounted)setState({scope,data:null,loading:false,error:"request_failed"})})
   .finally(()=>clearTimeout(deadline))
  return()=>{mounted=false;clearTimeout(deadline);controller.abort()}
 },[scope,retry])
 const visible=state.scope===scope?state:{scope,data:null,loading:true,error:null}
 return {...visible,refresh:()=>setRetry(n=>n+1)}
}
