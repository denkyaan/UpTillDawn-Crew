// Vite define performs textual replacement. Bind the full immutable payload
// exactly ONCE; reading the macro in each JSX expression duplicated the 83KB
// stylesheet three times in the generated login JavaScript.
declare const __UPT_EXACT_MAIN_LOGIN_CSS__: {sheets:Record<string,string>;routes:Record<string,string[]>}|null
const exactLoginCss=__UPT_EXACT_MAIN_LOGIN_CSS__
export function hasExactAuthStyles(pathname:string){
 return Boolean(exactLoginCss?.routes[pathname]?.length)
}
export function ExactAuthStyles({pathname}:{pathname:string}){
 if(!exactLoginCss)return null
 return <>{exactLoginCss.routes[pathname]?.map(href=><style key={href}>{exactLoginCss.sheets[href]}</style>)}</>
}
