const CACHE='uptilldawn-public-v12'
const PUBLIC_ASSETS=['/offline.html','/offline-public.html','/offline-content.js','/up-till-dawn-mark.webp']

self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PUBLIC_ASSETS)))})
self.addEventListener('message',event=>{if(event.data?.type==='UPT_ACTIVATE_UPDATE')event.waitUntil(self.skipWaiting())})
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('uptilldawn-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))})

async function privateOfflineResponse(){
 const cached=await caches.match('/offline.html')
 if(!cached)return cached
 const html=await cached.text()
 return new Response(html.replace('</body>','<script src="/offline-content.js"></script></body>'),{status:200,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}})
}

self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return
 const url=new URL(event.request.url)
 if(url.origin!==self.location.origin)return
 if(event.request.mode==='navigate'){
  const publicRoute=url.pathname==='/login'||url.pathname.startsWith('/login/')||url.pathname==='/signup'||url.pathname==='/forgot-password'||url.pathname==='/verify-email'||url.pathname==='/disabled'||url.pathname==='/unauthorized'||url.pathname.startsWith('/auth/')
  event.respondWith(fetch(event.request).catch(()=>publicRoute?caches.match('/offline-public.html'):privateOfflineResponse()))
 }else if(PUBLIC_ASSETS.includes(url.pathname))event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request)))
})

function safeLocalPath(value){return typeof value==='string'&&value.startsWith('/')&&!value.startsWith('//')&&!value.includes('\\')?value:'/notifications'}
async function notifyOpenClients(){const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const client of windows)client.postMessage({type:'UPT_PUSH_REFRESH'})}
self.addEventListener('push',event=>{let payload={};try{payload=event.data?event.data.json():{}}catch{}const title=payload.title||'Up Till Dawn',body=payload.body||'Je hebt een nieuwe melding.',link=safeLocalPath(payload.link),tag=payload.notificationId?'uptilldawn-'+payload.notificationId:'uptilldawn-notification';const promises=[self.registration.showNotification(title,{body,icon:'/up-till-dawn-mark.webp',badge:'/up-till-dawn-mark.webp',tag,renotify:true,data:{url:link,notificationId:payload.notificationId||null}}),notifyOpenClients(),self.registration.update().catch(()=>{})];if(Number.isFinite(payload.badgeCount)&&payload.badgeCount>=0&&self.navigator.setAppBadge)promises.push(payload.badgeCount>0?self.navigator.setAppBadge(payload.badgeCount):self.navigator.clearAppBadge?.());event.waitUntil(Promise.all(promises.filter(Boolean)))})
self.addEventListener('notificationclick',event=>{event.notification.close();const link=safeLocalPath(event.notification.data?.url),target=new URL(link,self.location.origin).href;event.waitUntil((async()=>{const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const client of windows){if(new URL(client.url).origin===self.location.origin){if('navigate'in client)await client.navigate(target);return client.focus()}}return self.clients.openWindow(target)})())})
function decodeApplicationServerKey(value){const padding='='.repeat((4-(value.length%4))%4),base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/'),raw=atob(base64);return Uint8Array.from(raw,char=>char.charCodeAt(0))}
async function renewPushSubscription(){const configResponse=await fetch('/api/push/config',{credentials:'include',cache:'no-store'});if(!configResponse.ok)return false;const config=await configResponse.json(),subscription=await self.registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeApplicationServerKey(config.publicKey)}),json=subscription.toJSON();if(!json.keys?.p256dh||!json.keys?.auth)return false;const saveResponse=await fetch('/api/push/subscription',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({endpoint:subscription.endpoint,keys:json.keys})});return saveResponse.ok}
self.addEventListener('pushsubscriptionchange',event=>{event.waitUntil((async()=>{const renewed=await renewPushSubscription().catch(()=>false);if(!renewed)await notifyOpenClients()})())})
self.addEventListener('periodicsync',event=>{if(event.tag!=='uptilldawn-app-refresh')return;event.waitUntil(Promise.all([self.registration.update().catch(()=>{}),fetch('/manifest.webmanifest',{cache:'no-store'}).catch(()=>null),notifyOpenClients()]))})
