'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/crew-server'

const uuid=z.string().uuid()
const step=z.enum(['briefing','safety','map','workplace','responsible','inventory','confirmed'])

export async function completeEventOnboardingStep(fd:FormData){
  const s=await createClient()
  const {data:{user}}=await s.auth.getUser()
  if(!user)throw new Error('Aanmelden vereist.')
  const {data:approved}=await s.rpc('upt_is_approved')
  if(!approved)throw new Error('ACCOUNT NOG NIET GOEDGEKEURD')
  const eventId=uuid.parse(fd.get('event_id'))
  const value=step.parse(fd.get('step'))
  const {error}=await s.rpc('upt_complete_event_onboarding_step',{p_event:eventId,p_step:value})
  if(error)throw new Error(error.message)
  revalidatePath('/onboarding')
  revalidatePath('/events')
}
