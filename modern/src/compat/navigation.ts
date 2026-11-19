import {useMemo} from 'react'
import {useLocation,useNavigate,useParams as routerParams} from 'react-router-dom'
function safePath(path:string){if(!path.startsWith('/')||path.startsWith('//')||path.includes('\\'))throw Error('Invalid navigation');return path}
export function useRouter(){
 const navigate=useNavigate()
 return useMemo(()=>({push:(path:string)=>void navigate(safePath(path)),replace:(path:string)=>void navigate(safePath(path),{replace:true}),refresh:()=>window.dispatchEvent(new Event('upt-source-refresh')),back:()=>void navigate(-1),forward:()=>void navigate(1),prefetch:()=>{}}),[navigate])
}
export function useSearchParams(){return new URLSearchParams(useLocation().search)}
export function usePathname(){return useLocation().pathname}
export const useParams=routerParams
export function redirect(path:string):never{window.location.replace(safePath(path));throw new Error('DOCUMENT_REDIRECT')}
export function notFound():never{throw new Error('DOCUMENT_NOT_FOUND')}
