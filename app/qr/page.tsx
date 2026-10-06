import {redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/crew-server'
import QrShiftRequest from '@/components/crew/qr-shift-request'

export const dynamic='force-dynamic'

export default async function QrEntryPage(){
 const s=await createClient()
 const {data:{user}}=await s.auth.getUser()
 if(!user)redirect('/login?next=/qr')
 const {data:profileRows,error:profileError}=await s.rpc('upt_current_profile')
 const profile=profileRows?.[0]??null
 if(profileError||!profile?.approved||profile.account_blocked)redirect('/unauthorized')
 return <QrShiftRequest/>
}
