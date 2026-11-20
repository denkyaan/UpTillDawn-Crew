import type {ReactNode} from "react"

export function WhenLoading({loading,error,children}:{loading:boolean;error:string|null;children:ReactNode}){
 if(loading)return <p role="status" className="notice">Gegevens worden opgehaald…</p>
 if(error)return <p role="alert" className="error">Gegevens tijdelijk onbereikbaar. Er zijn geen wijzigingen uitgevoerd.</p>
 return <>{children}</>
}
export function DataList({children,empty}:{children:ReactNode;empty:boolean}){
 return empty?<p className="muted">Geen gegevens beschikbaar voor je huidige toegang.</p>:<ul className="list">{children}</ul>
}
export function Refresh({onClick}:{onClick:()=>void}){
 return <button type="button" className="primary" onClick={onClick}>Vernieuwen</button>
}
export function Timestamp({value}:{value:string|null|undefined}){
 if(!value)return <span className="muted">—</span>
 const time=Date.parse(value)
 return <time dateTime={value}>{Number.isFinite(time)?new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeStyle:"short"}).format(new Date(time)):"—"}</time>
}
export function LocalMoney({amount,currency="EUR"}:{amount:number;currency?:string}){
 if(!Number.isFinite(amount))return <>—</>
 const safeCurrency=/^[A-Z]{3}$/.test(currency)?currency:"EUR"
 try{return <>{new Intl.NumberFormat(undefined,{style:"currency",currency:safeCurrency}).format(amount)}</>}
 catch{return <>—</>}
}
