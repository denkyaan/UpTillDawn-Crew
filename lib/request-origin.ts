/** Validate the browser origin against the HTTP host, including an internal Next.js URL. */
export function requestHasSameOrigin(request: Request): boolean {
 const origin=request.headers.get('origin')
 if(!origin)return false
 try{
  const url=new URL(request.url)
  if(url.protocol!=='http:'&&url.protocol!=='https:')return false
  const host=request.headers.get('host')
  if(host!==null){
   if(!host||/[\s,\/\\@?#]/.test(host))return false
   // Next.js can construct request.url with localhost while retaining the real Host.
   // Forwarded headers are deliberately not used as an independent origin grant.
   const expected=new URL(`${url.protocol}//${host}`)
   return origin===expected.origin
  }
  return origin===url.origin
 }catch{return false}
}
