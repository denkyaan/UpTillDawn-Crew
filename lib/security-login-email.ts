type SecurityLoginOutcome = 'success' | 'failure' | 'blocked' | 'denied'

export type SecurityLoginEmail = {
  outcome: SecurityLoginOutcome
  login: string
  canonicalLogin?: string | null
  portal: 'staff' | 'responsible' | 'admin'
  ip?: string | null
  approximateLocation?: string | null
  userAgent?: string | null
  reason?: string | null
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function label(outcome: SecurityLoginOutcome) {
  if (outcome === 'success') return 'GESLAAGD'
  if (outcome === 'blocked') return 'GEBLOKKEERD'
  if (outcome === 'denied') return 'GEWEIGERD'
  return 'MISLUKT'
}

function describeDevice(userAgent?: string | null) {
  const ua = userAgent || ''
  let device = 'Onbekend toestel'
  if (/iPhone/i.test(ua)) device = 'iPhone'
  else if (/iPad/i.test(ua)) device = 'iPad'
  else if (/Android/i.test(ua)) device = /Mobile/i.test(ua) ? 'Android telefoon' : 'Android toestel'
  else if (/Windows NT/i.test(ua)) device = 'Windows-pc'
  else if (/Macintosh|Mac OS X/i.test(ua)) device = 'Mac'
  else if (/Linux/i.test(ua)) device = 'Linux-computer'

  let browser = 'Onbekende browser'
  if (/Edg\//i.test(ua)) browser = 'Microsoft Edge'
  else if (/OPR\//i.test(ua)) browser = 'Opera'
  else if (/Chrome\//i.test(ua)) browser = 'Google Chrome'
  else if (/Firefox\//i.test(ua)) browser = 'Mozilla Firefox'
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari'

  return { device, browser }
}

export async function sendSecurityLoginEmail(event: SecurityLoginEmail): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('[security-email] RESEND_API_KEY ontbreekt')
    return false
  }

  const recipient = process.env.SECURITY_ALERT_EMAIL || 'steegmanskyani@gmail.com'
  const from = process.env.SECURITY_FROM_EMAIL || 'UpTillDawn Security <onboarding@resend.dev>'
  const now = new Date()
  const timestamp = new Intl.DateTimeFormat('nl-BE', {
    timeZone: 'Europe/Brussels',
    dateStyle: 'full',
    timeStyle: 'medium',
  }).format(now)
  const timestampIso = now.toISOString()
  const status = label(event.outcome)
  const login = event.login || 'onbekend'
  const canonical = event.canonicalLogin && event.canonicalLogin !== event.login ? event.canonicalLogin : null
  const ip = event.ip || 'onbekend'
  const location = event.approximateLocation || 'onbekend'
  const agent = event.userAgent || 'onbekend'
  const { device, browser } = describeDevice(event.userAgent)
  const reason = event.reason || '—'

  const text = [
    `UpTillDawn loginpoging: ${status}`,
    `Datum en tijd: ${timestamp} (Europe/Brussels)`,
    `ISO-tijdstip: ${timestampIso}`,
    `Portaal: ${event.portal}`,
    `Login: ${login}`,
    canonical ? `Gekoppeld account: ${canonical}` : null,
    `IP-adres: ${ip}`,
    `Adres / locatie (benadering): ${location}`,
    `Toestel: ${device}`,
    `Browser: ${browser}`,
    `User-Agent: ${agent}`,
    `Reden: ${reason}`,
  ].filter(Boolean).join('\n')

  const html = `
    <h2>UpTillDawn loginpoging: ${escapeHtml(status)}</h2>
    <table>
      <tr><td><strong>Datum en tijd</strong></td><td>${escapeHtml(timestamp)} (Europe/Brussels)</td></tr>
      <tr><td><strong>ISO-tijdstip</strong></td><td>${escapeHtml(timestampIso)}</td></tr>
      <tr><td><strong>Portaal</strong></td><td>${escapeHtml(event.portal)}</td></tr>
      <tr><td><strong>Login</strong></td><td>${escapeHtml(login)}</td></tr>
      ${canonical ? `<tr><td><strong>Gekoppeld account</strong></td><td>${escapeHtml(canonical)}</td></tr>` : ''}
      <tr><td><strong>IP-adres</strong></td><td>${escapeHtml(ip)}</td></tr>
      <tr><td><strong>Adres / locatie (benadering)</strong></td><td>${escapeHtml(location)}</td></tr>
      <tr><td><strong>Toestel</strong></td><td>${escapeHtml(device)}</td></tr>
      <tr><td><strong>Browser</strong></td><td>${escapeHtml(browser)}</td></tr>
      <tr><td><strong>User-Agent</strong></td><td>${escapeHtml(agent)}</td></tr>
      <tr><td><strong>Reden</strong></td><td>${escapeHtml(reason)}</td></tr>
    </table>
  `

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3500)

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject: `[UpTillDawn] Login ${status} – ${event.portal}`,
        text,
        html,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      console.error('[security-email] Resend weigerde de login-alert', {
        status: response.status,
        detail: detail.slice(0, 1000),
      })
      return false
    }

    return true
  } catch (error) {
    console.error('[security-email] Login-alert kon niet worden verstuurd', error instanceof Error ? error.message : 'onbekende fout')
    return false
  } finally {
    clearTimeout(timeout)
  }
}
