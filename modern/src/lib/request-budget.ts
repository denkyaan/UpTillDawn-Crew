// Browser-only request scheduler: bounded simultaneous RLS reads without
// introducing a Worker proxy, global data cache, polling or exponential retry.
// Auth/session checks and sensitive mutations deliberately bypass this queue.
const MAX_ACTIVE=3
const MAX_QUEUED=16
let active=0

type Waiter={
 signal:AbortSignal
 run:()=>void
 cancel:()=>void
}
const pending:Waiter[]=[]
function aborted():Error{const e=new Error("request_cancelled");e.name="AbortError";return e}
function drain():void{
 while(active<MAX_ACTIVE&&pending.length){
  const item=pending.shift()!
  if(item.signal.aborted){item.cancel();continue}
  active++
  item.run()
 }
}
export function readBudgetStatus():{active:number;queued:number}{
 return {active,queued:pending.length}
}
export function withReadBudget<T>(signal:AbortSignal,execute:()=>Promise<T>):Promise<T>{
 if(signal.aborted)return Promise.reject(aborted())
 if(pending.length>=MAX_QUEUED&&active>=MAX_ACTIVE)
  return Promise.reject(new Error("request_budget_busy"))
 return new Promise<T>((resolve,reject)=>{
  let started=false,settled=false
  const cleanup=()=>signal.removeEventListener("abort",onAbort)
  const cancel=()=>{
   if(settled)return
   settled=true
   cleanup()
   reject(aborted())
  }
  const onAbort=()=>{
   if(started)return // in-flight PostgREST uses the SAME AbortSignal.
   const index=pending.indexOf(item)
   if(index>=0)pending.splice(index,1)
   cancel()
  }
  const item:Waiter={
   signal,cancel,run:()=>{
    if(signal.aborted){
     active--
     cancel()
     drain()
     return
    }
    started=true
    void Promise.resolve().then(execute).then(
     value=>{if(!settled){settled=true;resolve(value)}},
     reason=>{if(!settled){settled=true;reject(reason)}},
    ).finally(()=>{
     cleanup()
     active--
     drain()
    })
   }
  }
  signal.addEventListener("abort",onAbort,{once:true})
  pending.push(item)
  drain()
 })
}
