import {useLayoutEffect,useMemo,useRef} from 'react'
import {useLocation,useNavigate,useParams as routerParams} from 'react-router-dom'
function safePath(path:string){if(!path.startsWith('/')||path.startsWith('//')||path.includes('\\'))throw Error('Invalid navigation');return path}
export function useRouter(){
 const navigate=useNavigate(),current=useRef(navigate)
 useLayoutEffect(()=>{current.current=navigate},[navigate])
 return useMemo(()=>({push:(path:string)=>void current.current(safePath(path)),replace:(path:string)=>void current.current(safePath(path),{replace:true}),refresh:()=>window.dispatchEvent(new Event('upt-source-refresh')),back:()=>void current.current(-1),forward:()=>void current.current(1),prefetch:()=>{}}),[])
}
export function useSearchParams(){const {search}=useLocation();return useMemo(()=>new URLSearchParams(search),[search])}
export function usePathname(){return useLocation().pathname}
export const useParams=routerParams
export function redirect(path:string):never{window.location.replace(safePath(path));throw new Error('DOCUMENT_REDIRECT')}
export function notFound():never{throw new Error('DOCUMENT_NOT_FOUND')}
