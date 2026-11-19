import type {ImgHTMLAttributes} from "react"

type Props=ImgHTMLAttributes<HTMLImageElement>&{src:string;priority?:boolean;unoptimized?:boolean}
// Match Next's unoptimized image sizing and loading attributes. The original
// asset bytes are served directly, without an image processing Worker.
export default function Image({priority,unoptimized:_unoptimized,loading,...props}:Props){
 return <img {...props} decoding="async" loading={priority?undefined:loading||"lazy"} fetchPriority={priority?"high":undefined} style={{color:"transparent",...props.style}}/>
}
