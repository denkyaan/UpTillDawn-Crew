// An opaque cookie reference is resolved only by the fixed, owner-checked
// server RPC bridge. The HttpOnly God credential never enters browser code.
export async function cookies(){
 const values=document.cookie.split(';').map(part=>{const i=part.indexOf('=');return {name:part.slice(0,i).trim(),value:part.slice(i+1)}})
 return {get:(name:string)=>name==='uptilldawn-god-session'?{name,value:'server-managed-god-session'}:values.find(c=>c.name===name),getAll:()=>values,set:()=>{throw Error('Server cookies require the original server action')}}
}
