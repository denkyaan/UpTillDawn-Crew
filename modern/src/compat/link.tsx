import {forwardRef,type AnchorHTMLAttributes} from 'react'
import {useNavigate} from 'react-router-dom'
type Props=Omit<AnchorHTMLAttributes<HTMLAnchorElement>,'href'>&{href:string|{pathname?:string;query?:Record<string,string|number|undefined>};prefetch?:boolean;replace?:boolean;scroll?:boolean}
const Link=forwardRef<HTMLAnchorElement,Props>(function Link({href,prefetch:_prefetch,replace,scroll,onClick,...props},ref){
 const navigate=useNavigate()
 const url=typeof href==='string'?href:(href.pathname||'')+(href.query?'?'+new URLSearchParams(Object.entries(href.query).filter((x):x is [string,string|number]=>x[1]!==undefined).map(([k,v])=>[k,String(v)])):'')
 return <a ref={ref} href={url} {...props} onClick={event=>{
  onClick?.(event)
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||props.target&&props.target!=='_self'||props.download!==undefined)return
  const target=new URL(url,window.location.href)
  if(target.origin!==window.location.origin||target.pathname.startsWith('/api/'))return
  event.preventDefault();void navigate(target.pathname+target.search+target.hash,{replace})
  if(scroll!==false&&!target.hash)window.scrollTo(0,0)
 }}/>
})
export default Link
