import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.BOT_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.BOT_SERVICE_ROLE_KEY
const password = process.env.BOT_TEST_PASSWORD

if (!supabaseUrl || !serviceRoleKey || !password) {
  console.error('Missing BOT_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL, BOT_SERVICE_ROLE_KEY or BOT_TEST_PASSWORD')
  process.exit(1)
}

const roles = ['admin', 'responsible', ...Array(13).fill('staff')]
const locales = ['nl', 'fr', 'en', 'de']
const dbRoles = {
  admin: 'admin',
  responsible: 'responsible_lead',
  staff: 'staff',
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

const created = []

for (let index = 0; index < roles.length; index += 1) {
  const portalRole = roles[index]
  const locale = locales[index % locales.length]
  const bot = `bot-${String(index + 1).padStart(2, '0')}-${portalRole}-${locale}`
  const email = `${bot}@bots.uptilldawn.test`
  const fullName = `E2E ${portalRole.toUpperCase()} ${String(index + 1).padStart(2, '0')}`

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (error || !data.user) {
    console.error(`Failed to create ${email}: ${error?.message || 'no user returned'}`)
    process.exit(1)
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: data.user.id,
      full_name: fullName,
      approved: true,
      role: dbRoles[portalRole],
      account_blocked: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })

  if (profileError) {
    console.error(`Failed to prepare profile for ${email}: ${profileError.message}`)
    process.exit(1)
  }

  created.push({ bot, email, portalRole, userId: data.user.id })
}

console.log(`PASS: seeded ${created.length} isolated authenticated browser-bot accounts`)


// Seed one deterministic browser-action event so staff/responsible bots can
// mutate availability through the actual UI without touching production data.
const admin = created[0]
const responsible = created[1]
const staff = created[2]
const eventId = '00000000-0000-4000-8000-00000000e2e1'
const workplaceId = '00000000-0000-4000-8000-00000000e2e2'
const startsAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
const endsAt = new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString()
const { error: eventError } = await supabase.from('events').upsert({
  id: eventId,
  name: 'E2E Browser Action Event',
  start_date: startsAt,
  end_date: endsAt,
  start_at: startsAt,
  end_at: endsAt,
  status: 'scheduled',
  created_by: admin.userId,
}, { onConflict: 'id' })
if (eventError) throw eventError
const { error: workplaceError } = await supabase.from('workplaces').upsert({
  id: workplaceId,
  event_id: eventId,
  name: 'E2E Entrance',
  sort_order: 1,
  is_active: true,
}, { onConflict: 'id' })
if (workplaceError) throw workplaceError
const { error: membersError } = await supabase.from('event_members').upsert([
  { event_id: eventId, user_id: responsible.userId, event_role: 'responsible_lead' },
  { event_id: eventId, user_id: staff.userId, event_role: 'employee' },
], { onConflict: 'event_id,user_id' })
if (membersError) throw membersError
const { error: responsibleError } = await supabase.from('responsible_assignments').insert({
  event_id: eventId,
  workplace_id: workplaceId,
  user_id: responsible.userId,
  assigned_by: admin.userId,
})
if (responsibleError) throw responsibleError

const briefingId = '00000000-0000-4000-8000-00000000e2e3'
const { error: briefingError } = await supabase.from('briefings').upsert({
  id: briefingId,
  event_id: eventId,
  workplace_id: workplaceId,
  title: 'E2E Entrance Briefing',
  body: 'E2E briefing acknowledgement fixture',
  version: 1,
  created_by: admin.userId,
}, { onConflict: 'id' })
if (briefingError) throw briefingError

const shiftId = '00000000-0000-4000-8000-00000000e2e4'
const shiftStart = new Date(Date.now() - 15 * 60 * 1000).toISOString()
const shiftEnd = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
const { error: shiftError } = await supabase.from('shifts').upsert({
  id: shiftId,
  event_id: eventId,
  workplace_id: workplaceId,
  user_id: staff.userId,
  start_time: shiftStart,
  end_time: shiftEnd,
  scheduled_start: shiftStart,
  scheduled_end: shiftEnd,
  role: 'staff',
  role_name: 'Entrance',
  status: 'scheduled',
  response_status: 'accepted',
  responsible_lead_id: responsible.userId,
  overlap_allowed: false,
}, { onConflict: 'id' })
if (shiftError) throw shiftError

console.log('Seeded browser-action event', eventId)
