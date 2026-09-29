import { authorizeStudio, studioFailure, studioResponse } from '@/lib/god-studio-server'

export async function GET(request: Request) {
  try {
    const { client } = await authorizeStudio(request)
    const { data: isOwner, error: ownerError } = await client.rpc('upt_current_is_owner')
    if (ownerError || isOwner !== true) return studioResponse({ error: 'Alleen de maker kan automatiseringen beheren.' }, 403)

    const { data, error } = await client.from('automation_rules')
      .select('automation_key,label,description,enabled,trigger_key,action_key,delay_minutes,reminder_minutes,escalation_minutes,audience,channels,auto_action,audit_enabled,cooldown_minutes,max_retries,last_run_at,settings')
      .order('automation_key')
    if (error) throw error
    return studioResponse({ rules: data || [] })
  } catch (error) {
    return studioFailure(error)
  }
}
