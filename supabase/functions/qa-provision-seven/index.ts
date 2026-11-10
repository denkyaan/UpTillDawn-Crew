import { createClient } from 'npm:@supabase/supabase-js@2.106.2'

// This endpoint is deployed ONLY on the UpTillDawn main-test Supabase project.
// It requires a verified Maker/Owner JWT and the exact main-test app origin.
// The service-role key never leaves this Edge Function.
const expectedProject = 'https://npbjrtiolqperdgljnhi.supabase.co'
const expectedOrigin = 'https://uptilldawn-main.uptilldawn.workers.dev'
const roster = [
  { role: 'Head Admin', email: 'e2e-head-admin@uptilldawn.test', roleOne: 'head' },
  { role: 'Linkerhand', email: 'e2e-left-hand@uptilldawn.test', roleOne: 'left_hand' },
  { role: 'Rechterhand', email: 'e2e-right-hand@uptilldawn.test', roleOne: 'right_hand' },
  { role: 'Verantwoordelijke', email: 'e2e-responsible@uptilldawn.test', roleOne: 'responsible_lead' },
  { role: 'Personeel', email: 'e2e-staff@uptilldawn.test', roleOne: 'staff' },
  { role: 'Promotie', email: 'e2e-promotion@uptilldawn.test', roleOne: 'promotion' },
  { role: 'Administratie', email: 'e2e-administration@uptilldawn.test', roleOne: 'administration' },
] as const
type UserLite = { id: string; email?: string }

function fail(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}
function strongPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return 'QA!7' + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return fail(405, 'POST required')
  if (req.headers.get('origin') !== expectedOrigin) return fail(403, 'Invalid origin')
  const url = Deno.env.get('SUPABASE_URL')?.replace(/\/$/, '')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (url !== expectedProject || !serviceKey || !anonKey) return fail(503, 'Not a configured QA project')
  const bearer = req.headers.get('authorization') || ''
  if (!/^Bearer\s+\S+$/i.test(bearer)) return fail(401, 'Sign in as Maker first')
  const jwt = bearer.replace(/^Bearer\s+/i, '')
  const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: identity, error: identityError } = await service.auth.getUser(jwt)
  if (identityError || !identity.user) return fail(401, 'Invalid session')
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: 'Bearer ' + jwt } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: owner, error: ownerError } = await userClient.rpc('upt_current_is_owner')
  if (ownerError || owner !== true) return fail(403, 'Only Maker/Owner may provision QA identities')

  try {
    const users = new Map<string, UserLite>()
    for (let page = 1; page <= 50; page++) {
      const { data, error } = await service.auth.admin.listUsers({ page, perPage: 100 })
      if (error) throw new Error('qa_list_users')
      for (const user of data.users) if (user.email) users.set(user.email.toLowerCase(), { id: user.id, email: user.email })
      if (data.users.length < 100) break
      if (page === 50) throw new Error('qa_pagination_limit')
    }
    // No duplicates, unknown QA identities, or accidental production/staff promotion.
    const known = new Set([...roster.map(entry => entry.email), 'e2e-admin@uptilldawn.test'])
    for (const email of users.keys()) {
      if (email.startsWith('e2e-') && email.endsWith('@uptilldawn.test') && !known.has(email))
        throw new Error('qa_unexpected_account')
    }
    const legacy = users.get('e2e-admin@uptilldawn.test')
    if (legacy && users.has('e2e-left-hand@uptilldawn.test')) throw new Error('qa_left_hand_duplicate')

    const { data: leaders, error: leadersError } = await service
      .from('upt_organization_leadership').select('slot,user_id')
    if (leadersError) throw new Error('qa_leadership_unavailable')
    for (const slot of ['head', 'left_hand', 'right_hand']) {
      const assignment = (leaders || []).find(row => row.slot === slot)
      const intended = roster.find(row => row.roleOne === slot)
      const current = intended ? users.get(intended.email) : null
      if (assignment && assignment.user_id !== current?.id
          && !(slot === 'left_hand' && assignment.user_id === legacy?.id))
        throw new Error('qa_occupied_' + slot)
    }

    if (legacy) {
      const { error } = await service.auth.admin.updateUserById(legacy.id, {
        email: 'e2e-left-hand@uptilldawn.test', email_confirm: true,
        user_metadata: { full_name: 'e2e-left-hand' },
      })
      if (error) throw new Error('qa_rename_left_hand')
      users.delete('e2e-admin@uptilldawn.test')
      users.set('e2e-left-hand@uptilldawn.test', { id: legacy.id, email: 'e2e-left-hand@uptilldawn.test' })
    }

    const credentials: Array<{ role: string; email: string; password: string }> = []
    for (const item of roster) {
      const password = strongPassword()
      const name = item.email.split('@')[0]
      const existing = users.get(item.email)
      if (existing) {
        const { error } = await service.auth.admin.updateUserById(existing.id, {
          password, email_confirm: true, user_metadata: { full_name: name },
        })
        if (error) throw new Error('qa_rotate_' + item.roleOne)
      } else {
        const { data, error } = await service.auth.admin.createUser({
          email: item.email, password, email_confirm: true,
          user_metadata: { full_name: name },
        })
        if (error || !data.user) throw new Error('qa_create_' + item.roleOne)
        users.set(item.email, { id: data.user.id, email: item.email })
      }
      const id = users.get(item.email)?.id
      if (!id) throw new Error('qa_missing_identity')
      const { error: profileError } = await service.from('profiles').upsert({
        id, full_name: name, approved: true, account_blocked: false,
      }, { onConflict: 'id' })
      if (profileError) throw new Error('qa_approve_' + item.roleOne)
      credentials.push({ role: item.role, email: item.email, password })
    }

    // These are authenticated owner RPC calls, not service-role writes that bypass
    // Head/Deputy governance. Head is assigned first; all seven roles are atomic
    // per account according to upt_admin_set_two_personnel_roles.
    for (const item of roster) {
      const { error } = await userClient.rpc('upt_admin_set_two_personnel_roles', {
        p_user: users.get(item.email)?.id,
        p_role_one: item.roleOne,
        p_role_two: null,
        p_confirm_head: item.roleOne === 'head',
      })
      if (error) throw new Error('qa_role_' + item.roleOne + '_' + (error.code || 'unknown'))
    }

    const { data: slots, error: slotsError } = await service
      .from('upt_personnel_role_slots').select('user_id,role_one,role_two')
      .in('user_id', roster.map(entry => users.get(entry.email)?.id).filter(Boolean) as string[])
    if (slotsError || slots?.length !== 7) throw new Error('qa_role_check')
    for (const item of roster) {
      if (!slots.some(slot => slot.user_id === users.get(item.email)?.id
          && slot.role_one === item.roleOne && slot.role_two === null))
        throw new Error('qa_role_mismatch_' + item.roleOne)
    }
    return new Response(JSON.stringify({ ok: true, accounts: credentials }), {
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    })
  } catch (error) {
    // Never log or return credentials, user IDs, service keys, or JWTs.
    const code = error instanceof Error ? error.message.split('_').slice(0, 4).join('_') : 'qa_unknown'
    return fail(409, code)
  }
})
