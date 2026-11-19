import {forwardRef,type AnchorHTMLAttributes} from "react"

// The original public screens use ordinary document navigation. Keep their
// URLs, browser history, modifier keys and anchors; no Next router/runtime.
type Props=AnchorHTMLAttributes<HTMLAnchorElement>&{href:string;prefetch?:boolean;replace?:boolean;scroll?:boolean}
const Link=forwardRef<HTMLAnchorElement,Props>(function Link({href,prefetch:_prefetch,replace:_replace,scroll:_scroll,...props},ref){
 return <a ref={ref} href={href} {...props}/>
})
export default Link
