// Node-side hard deadline for APIs without built-in timeouts. Late
// resolution/rejection cannot overwrite the already settled result.
export async function withDeadline(label,operation,milliseconds){
 if(!Number.isFinite(milliseconds)||milliseconds<=0)throw Error('INVALID_DEADLINE')
 let timer
 try{
  return await Promise.race([
   Promise.resolve().then(operation),
   new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('DEADLINE_'+label)),milliseconds)})
  ])
 }finally{clearTimeout(timer)}
}
