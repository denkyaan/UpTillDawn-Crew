'use server'

import {revalidatePath} from 'next/cache'
import {createClient} from '@/lib/supabase/crew-server'

type QaBotCredentials={role:string;email:string;password:string}
export type QaBotProvisionState={
  status:'idle'|'ok'|'error'
  message:string
  accounts:QaBotCredentials[]
}
const project='https://npbjrtiolqperdgljnhi.supabase.co'
const origin='https://uptilldawn-main.uptilldawn.workers.dev'

export async function provisionOwnerQaBots(_previous:QaBotProvisionState):Promise<QaBotProvisionState>{
 void _previous
 const rejected=(message:string):QaBotProvisionState=>({status:'error',message,accounts:[]})
 if(process.env.NEXT_PUBLIC_SUPABASE_URL!==project||process.env.NEXT_PUBLIC_APP_URL!==origin)
  return rejected('De QA-bots kunnen alleen op de afzonderlijke main-testomgeving worden ingesteld.')
 const db=await createClient()
 const {data:{user},error:userError}=await db.auth.getUser()
 if(userError||!user)return rejected('Meld je opnieuw aan als Maker/Owner.')
 const {data:isOwner,error:ownerError}=await db.rpc('upt_current_is_owner')
 if(ownerError||isOwner!==true)return rejected('Alleen de permanente Maker/Owner mag QA-bots instellen.')
 // The server-side session is only used to convey its JWT to the separate
 // Supabase Edge Function. That function validates the JWT and owner status.
 const {data:{session},error:sessionError}=await db.auth.getSession()
 if(sessionError||!session||session.user.id!==user.id)
  return rejected('De aanmeldsessie is verlopen. Meld je opnieuw aan.')
 const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
 if(!key)return rejected('De testomgeving heeft nog geen geldige Supabase-configuratie.')
 try{
  const response=await fetch(project+'/functions/v1/qa-provision-seven',{
   method:'POST',cache:'no-store',
   headers:{
    'content-type':'application/json',
    'Origin':origin,
    'Authorization':'Bearer '+session.access_token,
    'apikey':key,
   },
   body:'{}',
   signal:AbortSignal.timeout(90000),
  })
  const payload=await response.json() as {
   ok?:boolean;accounts?:QaBotCredentials[];error?:string
  }
  if(!response.ok||payload.ok!==true)
   return rejected('QA-instelling gestopt zonder verder te gaan: '+(payload.error||'onbekende fout')+'.')
  if(!Array.isArray(payload.accounts)||payload.accounts.length!==7||
    !payload.accounts.every(a=>typeof a.email==='string'&&
      /^e2e-[a-z-]+@uptilldawn\.test$/.test(a.email)&&
      typeof a.role==='string'&&typeof a.password==='string'&&a.password.length>=24))
   return rejected('De server gaf geen volledige, geldige lijst met zeven QA-bots terug.')
  revalidatePath('/personnel')
  return {status:'ok',message:'Zeven rolbots zijn ingericht. Bewaar de inloggegevens nu als CSV; de wachtwoorden worden niet opnieuw getoond.',accounts:payload.accounts}
 }catch{
  return rejected('De QA-instelling kon niet worden afgerond. Controleer de verbinding en probeer opnieuw.')
 }
}
