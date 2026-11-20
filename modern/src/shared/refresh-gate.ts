// Coalesce repeated visibility/Auth refreshes but allow an auth change or
// sign-out to invalidate an in-flight result immediately. No JWT/token cache.
export function createRefreshGate(){
 let generation=0
 let active:{generation:number;promise:Promise<void>}|null=null
 return {
  validate(work:(ticket:number)=>Promise<void>):Promise<void>{
   if(active)return active.promise
   const ticket=++generation
   const promise=Promise.resolve().then(()=>work(ticket)).finally(()=>{
    if(active?.generation===ticket)active=null
   })
   active={generation:ticket,promise}
   return promise
  },
  invalidate():void{generation++;active=null},
  isCurrent(ticket:number):boolean{return ticket===generation}
 }
}
