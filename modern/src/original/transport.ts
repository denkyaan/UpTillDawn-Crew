import {encode,decode} from '../../../lib/migration/wire'
export async function invokeOriginalAction(id:string,args:unknown[]):Promise<unknown>{
 const body=new FormData();body.set('_id',id);body.set('_args',JSON.stringify(encode(args,body)))
 const response=await fetch('/api/migration/actions',{method:'POST',body,credentials:'same-origin',redirect:'error'})
 const result=await response.json()
 if(!response.ok)throw Error(result.error||'De actie kon niet worden uitgevoerd.')
 if(typeof result.redirect==='string'){window.location.assign(result.redirect);return}
 if(result.refresh)window.dispatchEvent(new Event('upt-source-refresh'))
 return decode(result.value,new FormData())
}
export async function invokeOriginalRead(id:string,args:unknown[]):Promise<unknown>{
 const response=await fetch('/api/migration/view-data',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,args})})
 const result=await response.json()
 if(!response.ok)throw Error('De gegevens konden niet worden geladen.')
 return result.value
}
