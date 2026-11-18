/* UpTillDawn modern candidate: static-only offline cache; never cache
   authenticated API, PostgREST, bank, Supabase auth, or private media. */
const CACHE="uptilldawn-modern-public-v1"
self.addEventListener("install",event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(["/","/index.html"])))
 self.skipWaiting()
})
self.addEventListener("activate",event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("uptilldawn-modern-")&&k!==CACHE).map(k=>caches.delete(k)))))
 self.clients.claim()
})
self.addEventListener("fetch",event=>{
 const request=event.request
 const url=new URL(request.url)
 if(request.method!=="GET"||url.origin!==self.location.origin||url.pathname.startsWith("/api/"))return
 if(request.mode==="navigate"){
  event.respondWith(fetch(request).catch(async()=>await caches.match("/index.html")||new Response("Offline",{status:503})))
  return
 }
 if(/\.(?:js|css|svg|png|webp|woff2?)$/.test(url.pathname)){
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
   if(response.ok&&response.type==="basic")void caches.open(CACHE).then(cache=>cache.put(request,response.clone()))
   return response
  })))
 }
})
