import { z } from 'zod'
import { authorizeStudio, studioFailure, studioResponse } from '@/lib/god-studio-server'

const role = z.enum(['staff','responsible_lead','admin'])

export async function POST(request: Request) {
  try {
    const { client } = await authorizeStudio(request)
    const body = z.object({ role }).parse(await request.json().catch(() => null))
    const { data: isOwner, error: ownerError } = await client.rpc('upt_current_is_owner')
    if (ownerError || isOwner !== true) return studioResponse({ error: 'Alleen de maker kan rolvoorbeelden openen.' }, 403)

    const { data, error } = await client.rpc('upt_set_admin_role_mode', { p_role: body.role })
    if (error || data !== body.role) return studioResponse({ error: 'De voorbeeldrol kon niet worden geactiveerd.' }, 409)

    return studioResponse({ ok: true, role: body.role })
  } catch (error) {
    if (error instanceof z.ZodError) return studioResponse({ error: 'Ongeldige voorbeeldrol.' }, 400)
    return studioFailure(error)
  }
}
