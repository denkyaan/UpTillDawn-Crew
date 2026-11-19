import {createContext,isValidElement,use,useContext,useEffect,useRef, type ReactNode} from 'react'

// Lifetime is one route + one authenticated identity revision. Suspended
// renders reuse the same promise; no authenticated result survives navigation.
type RequestScope={views:Map<string,Promise<ReactNode>>;objects:WeakMap<object,number>;sequence:number}
const Scope=createContext<RequestScope|null>(null)
function key(value:unknown,scope:RequestScope,depth=0):string{
 if(typeof value==='symbol'||typeof value==='bigint')return String(value)
 if(depth>12)return identity(value,scope)
 if(value===null||typeof value==='string'||typeof value==='number'||typeof value==='boolean'||value===undefined)return JSON.stringify(value)??'undefined'
 if(typeof value==='object'&&value!==null&&'$$typeof'in value&&typeof (value as {$$typeof:unknown}).$$typeof==='symbol'&&!isValidElement(value))return identity(value,scope)
 if(isValidElement(value))return 'element('+key(value.type,scope,depth+1)+':'+value.key+':'+key(value.props,scope,depth+1)+')'
 if(Array.isArray(value))return '['+value.map(x=>key(x,scope,depth+1)).join(',')+']'
 if(typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype)return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+key((value as Record<string,unknown>)[k],scope,depth+1)).join(',')+'}'
 return identity(value,scope)
}
function identity(value:unknown,scope:RequestScope){
 const obj=value as object
 let id=scope.objects.get(obj)
 if(id===undefined){id=++scope.sequence;scope.objects.set(obj,id)}
 return '@'+id
}
type SourceComponent=((props:Record<string,unknown>)=>ReactNode)&{load:(props:Record<string,unknown>)=>ReactNode|Promise<ReactNode>}
export function sourceView(id:string,factory:(props:Record<string,unknown>)=>ReactNode|Promise<ReactNode>):SourceComponent{
 function SourceView(props:Record<string,unknown>){
  const scope=useContext(Scope)
  if(!scope)throw Error('Original view request scope missing')
  const cacheKey=id+':'+key(props,scope)
  let pending=scope.views.get(cacheKey)
  if(!pending){pending=Promise.resolve().then(()=>factory(props));scope.views.set(cacheKey,pending)}
  return use(pending)
 }
 SourceView.load=factory
 return SourceView
}
// Original server pages sometimes call another page directly. Keep that
// composition as an ordinary promise, without invoking React hooks there.
export function loadSourceView(component:unknown,...args:unknown[]):unknown{
 const callable=component as ((...args:unknown[])=>unknown)&{load?:(...args:unknown[])=>unknown}
 return (callable.load??callable)(...args)
}
export function OriginalRequest({revision,children}:{revision:string;children:ReactNode}){
 // Ref-backed resources survive discarded concurrent renders. A useMemo
 // cache is lost when a transition suspends before committing its new scope.
 const resources=useRef(new Map<string,RequestScope>())
 let scope=resources.current.get(revision)
 if(!scope){scope={views:new Map(),objects:new WeakMap(),sequence:0};resources.current.set(revision,scope)}
 useEffect(()=>{for(const key of resources.current.keys())if(key!==revision)resources.current.delete(key)},[revision])
 return <Scope.Provider value={scope}>{children}</Scope.Provider>
}
