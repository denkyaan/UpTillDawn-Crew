import {useMemo} from "react"
import {useLocation} from "react-router-dom"

export function useRouter(){
 return useMemo(()=>({push:(path:string)=>window.location.assign(path),replace:(path:string)=>window.location.replace(path),refresh:()=>window.location.reload(),back:()=>window.history.back()}),[])
}
export function useSearchParams(){return new URLSearchParams(useLocation().search)}
export function usePathname(){return useLocation().pathname}
export function redirect(path:string):never{window.location.replace(path);throw new Error("DOCUMENT_REDIRECT")}
