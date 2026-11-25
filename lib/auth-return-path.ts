// Accept only an internal, unambiguous return location after email auth.
export function safeAuthReturnPath(value:string|null,origin:string):string {
 if(!value||!value.startsWith('/')||value.startsWith('//')||/[\\\u0000-\u0020\u007f]/.test(value))return '/'
 try{
  const url=new URL(value,origin)
  if(url.origin!==origin||url.username||url.password||url.pathname.startsWith('//'))return '/'
  return url.pathname+url.search+url.hash
 }catch{return '/'}
}
