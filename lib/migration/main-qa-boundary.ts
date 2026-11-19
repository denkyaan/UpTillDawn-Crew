import 'server-only'
export function migrationMainQa(){
 return process.env.NEXT_PUBLIC_APP_URL==='https://uptilldawn-main.uptilldawn.workers.dev'&&
 process.env.NEXT_PUBLIC_SUPABASE_URL==='https://npbjrtiolqperdgljnhi.supabase.co'
}
export function migrationRequestAllowed(request:Request){
 const site=request.headers.get('sec-fetch-site')
 return migrationMainQa()&&new URL(request.url).origin==='https://uptilldawn-main.uptilldawn.workers.dev'&&
 request.headers.get('origin')==='https://uptilldawn-main.uptilldawn.workers.dev'&&(!site||site==='same-origin')
}
