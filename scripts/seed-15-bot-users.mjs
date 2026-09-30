import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.BOT_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.BOT_SERVICE_ROLE_KEY
const password = process.env.BOT_TEST_PASSWORD || 'BotTest-Only!2026'

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing BOT_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or BOT_SERVICE_ROLE_KEY')
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
