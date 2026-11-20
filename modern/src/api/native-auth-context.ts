import {AsyncLocalStorage} from 'node:async_hooks'
import {parseCookieHeader,serializeCookieHeader} from '@supabase/ssr'
type CookieOptions=Parameters<typeof serializeCookieHeader>[2]
type Cookie={name:string;value:string}
export class NativeCookies{
 private values=new Map<string,string>()
 private mutations=new Map<string,string>()
 constructor(header=''){for(const cookie of parseCookieHeader(header))this.values.set(cookie.name,cookie.value??'')}
 get(name:string){const value=this.values.get(name);return value===undefined?undefined:{name,value}}
 getAll(){return Array.from(this.values,([name,value])=>({name,value}))}
 set(name:string|Cookie&CookieOptions,value?:string,options:CookieOptions={}):this{
  if(typeof name==='object'){const {name:key,value:text,...rest}=name;return this.set(key,text,rest)}
  const text=value??'',settings={path:'/',...options}
  if(settings.maxAge===0||settings.expires&&settings.expires.getTime()<=Date.now())this.values.delete(name)
  else this.values.set(name,text)
  this.mutations.set(name+'|'+(settings.domain??'')+'|'+settings.path,serializeCookieHeader(name,text,settings))
  return this
 }
 delete(name:string){return this.set(name,'',{path:'/',maxAge:0,expires:new Date(0)})}
 appendTo(headers:Headers){for(const value of this.mutations.values())headers.append('Set-Cookie',value)}
}
type Context={request:Request;env:Readonly<Record<string,string|undefined>>;cookies:NativeCookies}
const scope=new AsyncLocalStorage<Context>()
function current(){const value=scope.getStore();if(!value)throw Error('Native authentication request scope missing');return value}
export function withNativeAuth<T>(request:Request,env:Record<string,string|undefined>,run:()=>Promise<T>){return scope.run({request,env:Object.freeze({...env}),cookies:new NativeCookies(request.headers.get('cookie')??'')},run)}
export function nativeEnvironment(){return current().env}
export async function cookies(){return current().cookies}
export async function headers(){return current().request.headers}
// React.cache is a no-op outside a React server render. Keep API caches out of
// process-global state so concurrent actors never share sessions or clients.
export function cache<T>(fn:T):T{return fn}
export function revalidatePath(){}
export class NativeRedirect extends Error{
 digest:string
 target:string
 constructor(target:string){super('NEXT_REDIRECT');this.target=target;this.digest='NEXT_REDIRECT;replace;'+target+';307;'}
}
export function redirect(target:string):never{throw new NativeRedirect(target)}
export function isRedirectError(error:unknown){return error instanceof NativeRedirect}
export class NextRequest extends Request{
 get nextUrl(){return new URL(this.url)}
 get cookies(){return new NativeCookies(this.headers.get('cookie')??'')}
}
export class NextResponse extends Response{
 cookies=new NativeCookies()
 static json(body:unknown,init:ResponseInit={}){const values=new Headers(init.headers);if(!values.has('content-type'))values.set('Content-Type','application/json; charset=utf-8');return new NextResponse(JSON.stringify(body),{...init,headers:values})}
 static redirect(url:string|URL,init:number|ResponseInit=307){return new NextResponse(null,typeof init==='number'?{status:init,headers:{Location:String(url)}}:{...init,headers:new Headers([...new Headers(init.headers),['Location',String(url)]])})}
}
