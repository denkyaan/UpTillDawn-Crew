import {encode,decode} from '../../../lib/migration/wire'
export async function invokeOriginalAction(id:string,args:unknown[]):Promise<unknown>{
 const body=new FormData();body.set('_id',id);body.set('_args',JSON.stringify(encode(args,body)))
 const response=await fetch('/api/migration/actions',{method:'POST',body,credentials:'same-origin',redirect:'error'})
 const result=await response.json()
 if(!response.ok)throw Error(result.error||'De actie kon niet worden uitgevoerd.')
 if(typeof result.redirect==='string'){
  if(!result.redirect.startsWith('/')||result.redirect.startsWith('//')||result.redirect.includes('\\'))throw Error('Invalid action redirect')
  if(id.startsWith('lib/actions/auth.ts#')||id.startsWith('lib/actions/god-mode.ts#'))window.location.assign(result.redirect)
  else window.dispatchEvent(new CustomEvent('upt-source-navigate',{detail:result.redirect}))
  return
 }
 if(result.refresh)window.dispatchEvent(new Event('upt-source-refresh'))
 return decode(result.value,new FormData())
}
export async function invokeOriginalRead(id:string,args:unknown[]):Promise<unknown>{
 // Original view-data uses POST for a strictly read-only DTO. For the
 // integration readiness panel, allow ONE delayed retry of a transient
 // upstream gateway failure. This preserves the original page and avoids
 // an immediate retry storm against the Free-plan legacy Main Worker.
 const body=JSON.stringify({id,args})
 const transient=new Set([502,503,504])
 for(let attempt=0;attempt<2;attempt++){
  let response:Response
  try{
   response=await fetch('/api/migration/view-data',{method:'POST',credentials:'same-origin',
    headers:{'Content-Type':'application/json'},body})
  }catch{
   if(id!=='external-services-view'||attempt!==0)
    throw Error('De gegevens konden niet worden geladen.')
   await new Promise(resolve=>setTimeout(resolve,1800))
   continue
  }
  if(!response.ok&&id==='external-services-view'&&attempt===0&&transient.has(response.status)){
   await new Promise(resolve=>setTimeout(resolve,1800))
   continue
  }
  if(!response.ok)throw Error('De gegevens konden niet worden geladen.')
  let result:unknown
  try{result=await response.json()}catch{throw Error('De gegevens konden niet worden geladen.')}
  if(!result||typeof result!=='object'||!('value' in result))
   throw Error('De gegevens konden niet worden geladen.')
  return (result as {value:unknown}).value
 }
 throw Error('De gegevens konden niet worden geladen.')
}
