import { z } from 'zod'
import { authorizeStudio, studioFailure, studioResponse } from '@/lib/god-studio-server'

const role = z.enum(['staff','responsible_lead','admin'])

// Read the real active role before opening a preview. The visual builder must
// not imply the user is viewing Admin when the stored test role differs.
export async function GET(request: Request) {
  try {
    const { client } = await authorizeStudio(request)
    const { data: isOwner, error: ownerError } = await client.rpc('upt_current_is_owner')
    if (ownerError || isOwner !== true) return studioResponse({ error: 'Alleen de maker kan rolvoorbeelden openen.' }, 403)
    const { data, error } = await client.rpc('upt_current_effective_role')
    if (error || !role.safeParse(data).success) return studioResponse({ error: 'De actieve voorbeeldrol is niet beschikbaar.' }, 503)
    return studioResponse({ role: data })
  } catch (error) {
    return studioFailure(error)
  }
}

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
