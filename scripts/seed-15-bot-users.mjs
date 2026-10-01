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
const startsAt = new Date(Date.now() - 60 * 60 * 1000).toISOString()
const endsAt = new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString()
const { error: eventError } = await supabase.from('events').upsert({
  id: eventId,
  name: 'E2E Browser Action Event',
  start_date: startsAt,
  end_date: endsAt,
  start_at: startsAt,
  end_at: endsAt,
  status: 'active',
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

// Seed the workplace-scoped briefing only after the staff workplace assignment
// exists. This mirrors the production authorization contract used by
// upt_acknowledge_briefing/upt_can_access_workplace.
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

// Keep the browser action fixture deterministic. The strict E2E flow must
// start with bot03 not having acknowledged this briefing, then prove that the
// real UI action creates the acknowledgement under staff RLS.
const { error: briefingAckResetError } = await supabase
  .from('briefing_acknowledgements')
  .delete()
  .eq('briefing_id', briefingId)
  .eq('user_id', staff.userId)
if (briefingAckResetError) throw briefingAckResetError

const guestId = '00000000-0000-4000-8000-00000000e2e5'
const { error: guestError } = await supabase.from('event_guestlist_entries').upsert({
  id: guestId,
  event_id: eventId,
  name: 'E2E Guest',
  entry_type: 'guest',
  spots_total: 2,
  spots_checked_in: 0,
  source: 'manual',
  is_active: true,
  created_by: admin.userId,
}, { onConflict: 'id' })
if (guestError) throw guestError

const taskId = '00000000-0000-4000-8000-00000000e2e6'
const assignmentId = '00000000-0000-4000-8000-00000000e2e7'
const { error: taskError } = await supabase.from('tasks').upsert({
  id: taskId, event_id: eventId, workplace_id: workplaceId, title: 'E2E Entrance Task',
  description: 'Strict browser lifecycle task', status: 'open', created_by: responsible.userId,
}, { onConflict: 'id' })
if (taskError) throw taskError
const { error: assignmentError } = await supabase.from('task_assignments').upsert({
  id: assignmentId, task_id: taskId, user_id: staff.userId, assigned_by: responsible.userId, status: 'NOT STARTED', confirmed_at: null,
}, { onConflict: 'id' })
if (assignmentError) throw assignmentError

const inventoryId = '00000000-0000-4000-8000-00000000e2e8'
const { error: inventoryError } = await supabase.from('inventory_items').upsert({
  id: inventoryId, event_id: eventId, workplace_id: workplaceId, name: 'E2E Radio',
  category: 'E2E', total_quantity: 3, available_quantity: 3, issued_quantity: 0,
  damaged_quantity: 0, missing_quantity: 0, item_kind: 'asset', is_active: true, created_by: admin.userId,
}, { onConflict: 'id' })
if (inventoryError) throw inventoryError

const { data: eventChannel, error: eventChannelError } = await supabase
  .from('chat_channels')
  .select('id')
  .eq('event_id', eventId)
  .eq('kind', 'event')
  .maybeSingle()
if (eventChannelError) throw eventChannelError
if (!eventChannel) throw new Error('Expected automatic event chat channel was not created')
const { error: chatMemberError } = await supabase.from('chat_members').upsert([
  { channel_id: eventChannel.id, user_id: admin.userId },
  { channel_id: eventChannel.id, user_id: responsible.userId },
  { channel_id: eventChannel.id, user_id: staff.userId },
], { onConflict: 'channel_id,user_id' })
if (chatMemberError) throw chatMemberError

console.log('Seeded browser-action event', eventId)
