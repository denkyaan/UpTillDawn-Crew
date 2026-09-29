import { z } from 'zod'
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


export async function POST(request: Request) {
  try {
    const { client } = await authorizeStudio(request)
    const { data: isOwner, error: ownerError } = await client.rpc('upt_current_is_owner')
    if (ownerError || isOwner !== true) return studioResponse({ error: 'Alleen de maker kan automatiseringen beheren.' }, 403)
    const body = z.object({
      automation_key: z.string().trim().min(1).max(120).regex(/^[a-z0-9_-]+$/),
      enabled: z.boolean(),
    }).parse(await request.json())
    const { data: current, error: currentError } = await client.from('automation_rules')
      .select('delay_minutes,reminder_minutes,escalation_minutes,cooldown_minutes,max_retries,channels')
      .eq('automation_key', body.automation_key).single()
    if (currentError) throw currentError
    const { error } = await client.rpc('upt_save_automation_rule', {
      p_key: body.automation_key,
      p_enabled: body.enabled,
      p_delay_minutes: current.delay_minutes,
      p_reminder_minutes: current.reminder_minutes ?? 0,
      p_escalation_minutes: current.escalation_minutes ?? 0,
      p_cooldown_minutes: current.cooldown_minutes,
      p_max_retries: current.max_retries,
      p_channels: current.channels?.length ? current.channels : ['in_app'],
    })
    if (error) throw error
    return studioResponse({ ok: true })
  } catch (error) {
    if (error instanceof z.ZodError) return studioResponse({ error: 'Ongeldige automatiseringsinstelling.' }, 400)
    return studioFailure(error)
  }
}
