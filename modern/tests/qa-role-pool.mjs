// Bounded local role concurrency. Await all independent workers even when
// a role throws; never close the shared browser while another role is active.
export async function runRolePool(items,limit,work,onComplete=()=>{}){
 if(!Array.isArray(items)||!Number.isInteger(limit)||limit<1||limit>3)throw Error('INVALID_ROLE_POOL')
 let cursor=0,active=0,peak=0
 const errors=[],completed=[]
 async function worker(){
  while(cursor<items.length){
   const index=cursor++,item=items[index]
   active++;peak=Math.max(peak,active)
   let error=null
   try{await work(item)}catch(e){error=e;errors.push({index,error:e})}
   finally{active--;completed.push(index)}
   try{await onComplete({item,index,error})}catch(e){errors.push({index,error:e})}
  }
 }
 await Promise.all(Array.from({length:Math.min(limit,items.length)},worker))
 return {peak,completed,errors}
}
export function verifyExactCoverage(expected,actual){
 const wanted=new Set(expected),seen=new Set(),duplicates=[],unexpected=[]
 for(const key of actual){
  if(seen.has(key))duplicates.push(key)
  seen.add(key)
  if(!wanted.has(key))unexpected.push(key)
 }
 const missing=expected.filter(key=>!seen.has(key))
 return {complete:wanted.size===expected.length&&missing.length===0&&duplicates.length===0&&unexpected.length===0&&actual.length===expected.length,missing,duplicates,unexpected}
}
