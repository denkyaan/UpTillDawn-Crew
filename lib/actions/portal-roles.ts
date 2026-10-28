'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/crew-server'

const valid: Record<string, readonly string[]> = {
  events: ['event_staff', 'event_responsible'],
  promotion: ['promoter'],
  administration: ['administrative_staff'],
}

export async function changePortalRole(formData: FormData): Promise<void> {
  const current = await getCurrentUser()
  if (!current?.realIsAdmin || !current.approved || current.account_blocked) {
    throw new Error('Geen toegang')
  }
  const userId = String(formData.get('user_id') ?? '')
  const portal = String(formData.get('portal') ?? '')
  const role = String(formData.get('role') ?? '')
  const action = String(formData.get('action') ?? '')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId) ||
      !valid[portal]?.includes(role) || !['assign', 'approve', 'revoke'].includes(action) ||
      userId === current.id) {
    throw new Error('Ongeldige rolwijziging')
  }
  const supabase = await createClient()
  const { error } = await supabase.rpc('upt_admin_set_portal_role', {
    p_user_id: userId, p_portal: portal, p_role: role, p_action: action,
  })
  if (error) throw new Error('Rolwijziging niet uitgevoerd')
  revalidatePath('/crew')
  revalidatePath('/portals/administration/personnel')
  revalidatePath('/portals/roles')
  revalidatePath('/portals')
}
