// An opaque cookie reference is resolved only by the fixed, owner-checked
// server RPC bridge. The HttpOnly God credential never enters browser code.
import {invokeOriginalRead} from '../original/transport'
export async function cookies(includePortal=false,snapshot?:string){
 const values=(snapshot??document.cookie).split(';').map(part=>{const i=part.indexOf('=');return {name:part.slice(0,i).trim(),value:part.slice(i+1)}})
 if(includePortal){const preference=await invokeOriginalRead('portal-preference',[]) as {lastPortal?:string};if(preference.lastPortal)values.push({name:'uptilldawn-last-portal',value:preference.lastPortal})}
 return {get:(name:string)=>name==='uptilldawn-god-session'?{name,value:'server-managed-god-session'}:values.find(c=>c.name===name),getAll:()=>values,set:()=>{throw Error('Server cookies require the original server action')}}
}
