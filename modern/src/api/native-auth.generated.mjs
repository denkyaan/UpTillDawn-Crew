// Generated from original Main authentication sources. Server Worker only.
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// app/api/auth/portal-login/route.ts
var route_exports = {};
__export(route_exports, {
  POST: () => POST,
  dynamic: () => dynamic
});
import { NextResponse } from "./native-auth-context.ts";

// lib/actions/auth.ts
import { nativeEnvironment as __nativeEnvironment3 } from "./native-auth-context.ts";
import { redirect } from "./native-auth-context.ts";
import { cache as cache2 } from "./native-auth-context.ts";
import { cookies as cookies3, headers } from "./native-auth-context.ts";

// lib/supabase/crew-server.ts
import { nativeEnvironment as __nativeEnvironment } from "./native-auth-context.ts";
import { createServerClient } from "@supabase/ssr";
import { cache } from "./native-auth-context.ts";
import { cookies } from "./native-auth-context.ts";
var createRequestClient = cache(async () => {
  const cookieStore = await cookies();
  return createServerClient(__nativeEnvironment().NEXT_PUBLIC_SUPABASE_URL, __nativeEnvironment().NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
        }
      }
    }
  });
});
async function createClient() {
  return createRequestClient();
}

// lib/password-policy.ts
var PASSWORD_MIN_LENGTH = 12;
var LOWER = /[a-z]/;
var UPPER = /[A-Z]/;
var DIGIT = /[0-9]/;
var SYMBOL = /[^A-Za-z0-9]/;
function validatePassword(password) {
  const issues = [];
  if (password.length < PASSWORD_MIN_LENGTH)
    issues.push(`minstens ${PASSWORD_MIN_LENGTH} tekens`);
  if (!LOWER.test(password))
    issues.push("een kleine letter");
  if (!UPPER.test(password))
    issues.push("een hoofdletter");
  if (!DIGIT.test(password))
    issues.push("een cijfer");
  if (!SYMBOL.test(password))
    issues.push("een symbool");
  return { valid: issues.length === 0, issues };
}
function passwordPolicyMessage(password) {
  const result = validatePassword(password);
  return result.valid ? null : `Wachtwoord moet ${result.issues.join(", ")} bevatten.`;
}

// lib/security-login-email.ts
import { nativeEnvironment as __nativeEnvironment2 } from "./native-auth-context.ts";
function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function ipCoordinates(latitude, longitude) {
  if (!latitude || !longitude)
    return null;
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180)
    return null;
  return { lat, lon, label: lat.toFixed(5) + ", " + lon.toFixed(5), url: "https://www.google.com/maps?q=" + encodeURIComponent(lat + "," + lon) };
}
function label(outcome) {
  if (outcome === "success")
    return "GESLAAGD";
  if (outcome === "blocked")
    return "GEBLOKKEERD";
  if (outcome === "denied")
    return "GEWEIGERD";
  return "MISLUKT";
}
function describeDevice(userAgent) {
  const ua = userAgent || "";
  let device = "Onbekend toestel";
  if (/iPhone/i.test(ua))
    device = "iPhone";
  else if (/iPad/i.test(ua))
    device = "iPad";
  else if (/Android/i.test(ua))
    device = /Mobile/i.test(ua) ? "Android telefoon" : "Android toestel";
  else if (/Windows NT/i.test(ua))
    device = "Windows-pc";
  else if (/Macintosh|Mac OS X/i.test(ua))
    device = "Mac";
  else if (/Linux/i.test(ua))
    device = "Linux-computer";
  let browser = "Onbekende browser";
  if (/Edg\//i.test(ua))
    browser = "Microsoft Edge";
  else if (/OPR\//i.test(ua))
    browser = "Opera";
  else if (/Chrome\//i.test(ua))
    browser = "Google Chrome";
  else if (/Firefox\//i.test(ua))
    browser = "Mozilla Firefox";
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua))
    browser = "Safari";
  return { device, browser };
}
async function sendSecurityLoginEmail(event) {
  const apiKey = __nativeEnvironment2().RESEND_API_KEY;
  if (!apiKey) {
    console.error("[security-email] RESEND_API_KEY ontbreekt");
    return false;
  }
  const recipient = __nativeEnvironment2().SECURITY_ALERT_EMAIL || "steegmans.kyani@icloud.com";
  const from = __nativeEnvironment2().SECURITY_FROM_EMAIL || "UpTillDawn Security <onboarding@resend.dev>";
  const now = /* @__PURE__ */ new Date();
  const timestamp = new Intl.DateTimeFormat("nl-BE", {
    timeZone: "Europe/Brussels",
    dateStyle: "full",
    timeStyle: "medium"
  }).format(now);
  const timestampIso = now.toISOString();
  const status = label(event.outcome);
  const login = event.login || "onbekend";
  const canonical = event.canonicalLogin && event.canonicalLogin !== event.login ? event.canonicalLogin : null;
  const ip = event.ip || "onbekend";
  const location = event.approximateLocation || "onbekend";
  const coordinates = ipCoordinates(event.latitude, event.longitude);
  const agent = event.userAgent || "onbekend";
  const { device, browser } = describeDevice(event.userAgent);
  const reason = event.reason || "\u2014";
  const text = [
    `UpTillDawn admin-loginpoging: ${status}`,
    `Datum en tijd: ${timestamp} (Europe/Brussels)`,
    `ISO-tijdstip: ${timestampIso}`,
    `Portaal: ${event.portal}`,
    `Login: ${login}`,
    canonical ? `Gekoppeld account: ${canonical}` : null,
    `IP-adres: ${ip}`,
    `Adres / locatie (benadering): ${location}`,
    `IP-geolocatieco\xF6rdinaten (benadering): ${coordinates?.label || "niet beschikbaar"}`,
    coordinates ? `Kaart (IP-geolocatie): ${coordinates.url}` : null,
    `Toestel: ${device}`,
    `Browser: ${browser}`,
    `User-Agent: ${agent}`,
    `Reden: ${reason}`
  ].filter(Boolean).join("\n");
  const html = `
    <h2>UpTillDawn admin-loginpoging: ${escapeHtml(status)}</h2>
    <table>
      <tr><td><strong>Datum en tijd</strong></td><td>${escapeHtml(timestamp)} (Europe/Brussels)</td></tr>
      <tr><td><strong>ISO-tijdstip</strong></td><td>${escapeHtml(timestampIso)}</td></tr>
      <tr><td><strong>Portaal</strong></td><td>${escapeHtml(event.portal)}</td></tr>
      <tr><td><strong>Login</strong></td><td>${escapeHtml(login)}</td></tr>
      ${canonical ? `<tr><td><strong>Gekoppeld account</strong></td><td>${escapeHtml(canonical)}</td></tr>` : ""}
      <tr><td><strong>IP-adres</strong></td><td>${escapeHtml(ip)}</td></tr>
      <tr><td><strong>Adres / locatie (benadering)</strong></td><td>${escapeHtml(location)}</td></tr>
      <tr><td><strong>IP-geolocatieco\xF6rdinaten (benadering)</strong></td><td>${escapeHtml(coordinates?.label || "niet beschikbaar")}</td></tr>
      ${coordinates ? `<tr><td><strong>Kaart (IP-geolocatie)</strong></td><td><a href="${escapeHtml(coordinates.url)}">Bekijk geschatte locatie op Google Maps</a></td></tr>` : ""}
      <tr><td><strong>Toestel</strong></td><td>${escapeHtml(device)}</td></tr>
      <tr><td><strong>Browser</strong></td><td>${escapeHtml(browser)}</td></tr>
      <tr><td><strong>User-Agent</strong></td><td>${escapeHtml(agent)}</td></tr>
      <tr><td><strong>Reden</strong></td><td>${escapeHtml(reason)}</td></tr>
    </table>
  `;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject: `[UpTillDawn] Admin login ${status}`,
        text,
        html
      }),
      signal: controller.signal
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("[security-email] Resend weigerde de login-alert", {
        status: response.status,
        detail: detail.slice(0, 1e3)
      });
      return false;
    }
    return true;
  } catch (error) {
    console.error("[security-email] Login-alert kon niet worden verstuurd", error instanceof Error ? error.message : "onbekende fout");
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

// lib/save-success.ts
import { revalidatePath as nextRevalidatePath } from "./native-auth-context.ts";
import { cookies as cookies2 } from "./native-auth-context.ts";
var SAVE_SUCCESS_COOKIE = "upt-save-success";
async function markSaveSuccess(key = "saved") {
  const store = await cookies2();
  store.set(SAVE_SUCCESS_COOKIE, encodeURIComponent(key), {
    path: "/",
    sameSite: "lax",
    secure: true,
    maxAge: 60
  });
}

// lib/maker-login.ts
var MAKER_ACCOUNT_EMAIL = "steegmans.kyani@icloud.com";
var MAKER_LOGIN_ALIAS = "maker@uptilldawn";
function normalizeLogin(value) {
  return value.trim().toLowerCase();
}
function isMakerLogin(value) {
  const login = normalizeLogin(value);
  return login === MAKER_ACCOUNT_EMAIL || login === MAKER_LOGIN_ALIAS;
}
function resolveLoginEmail(value) {
  const login = normalizeLogin(value);
  return isMakerLogin(login) ? MAKER_ACCOUNT_EMAIL : login;
}

// lib/auth-callback-origin.ts
var MAIN = "https://uptilldawn-main.uptilldawn.workers.dev";
var CANDIDATE = "https://uptilldawn-modern-main.uptilldawn.workers.dev";
var QA = "https://npbjrtiolqperdgljnhi.supabase.co";
function authCallbackOrigin(appUrl, databaseUrl, requested) {
  let origin;
  try {
    const url = new URL(appUrl || "");
    if (!["http:", "https:"].includes(url.protocol))
      return null;
    origin = url.origin;
  } catch {
    return null;
  }
  return origin === MAIN && databaseUrl === QA && requested === CANDIDATE ? CANDIDATE : origin;
}

// lib/actions/auth.ts
function extractName(email) {
  const local = email.split("@")[0];
  return local.split(".").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ").slice(0, 200);
}
function appOrigin(requested = null) {
  const alternate = __nativeEnvironment3().UPT_MIGRATION_EMAIL_CALLBACK_READY === "true" ? requested : null;
  return authCallbackOrigin(__nativeEnvironment3().NEXT_PUBLIC_APP_URL, __nativeEnvironment3().NEXT_PUBLIC_SUPABASE_URL, alternate);
}
async function lookupIpLocation(ip) {
  const apiKey = __nativeEnvironment3().GEOAPIFY_API_KEY;
  if (!apiKey || !ip)
    return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2e3);
  try {
    const url = new URL("https://api.geoapify.com/v1/ipinfo");
    url.searchParams.set("ip", ip);
    url.searchParams.set("apiKey", apiKey);
    url.searchParams.set("lang", "nl");
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!response.ok)
      return null;
    const payload = await response.json();
    const parts = [
      payload.city?.name,
      payload.postcode,
      payload.state?.name,
      payload.country?.name
    ].filter((value) => Boolean(value));
    return parts.join(", ") || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
async function requestSecurityContext() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = h.get("cf-connecting-ip") || forwarded || h.get("x-real-ip") || null;
  const city = h.get("cf-ipcity");
  const region = h.get("cf-region");
  const country = h.get("cf-ipcountry");
  const cloudflareLocation = [city, region, country].filter(Boolean).join(", ") || null;
  const approximateLocation = cloudflareLocation || await lookupIpLocation(ip);
  return { ip, approximateLocation, userAgent: h.get("user-agent") };
}
async function adminSecurityRpc(supabase, fn, args) {
  const rpc = supabase.rpc.bind(supabase);
  return rpc(fn, args);
}
function signUpError(error) {
  const code = String(error.code || "").toLowerCase();
  const message = String(error.message || "").toLowerCase();
  if (code === "user_already_exists" || code === "email_exists" || message.includes("already registered") || message.includes("already been registered")) {
    return {
      error: "Er bestaat al een account met dit e-mailadres. Log in of gebruik wachtwoord herstellen.",
      code: "account_exists"
    };
  }
  if (code === "over_email_send_rate_limit" || error.status === 429 || message.includes("rate limit")) {
    return {
      error: "De verificatiemail kan nu niet worden verzonden omdat de e-maildienst tijdelijk te veel verzoeken ontvangt. Wacht enkele minuten en probeer opnieuw.",
      code: "email_rate_limit"
    };
  }
  if (code === "unexpected_failure" && (message.includes("send email") || message.includes("smtp") || message.includes("gomail") || message.includes("testing emails") || message.includes("verify a domain"))) {
    return {
      error: "Registratie kan niet worden afgerond omdat de verificatiemail niet kan worden verzonden. De e-maildienst staat momenteel in testmodus en accepteert nog niet alle e-mailadressen. Neem contact op met de beheerder of probeer een toegestaan testadres.",
      code: "email_delivery_test_mode"
    };
  }
  if (code === "email_address_invalid" || code === "validation_failed" || message.includes("invalid email")) {
    return {
      error: "Dit e-mailadres is niet geldig. Controleer het adres en probeer opnieuw.",
      code: "invalid_email"
    };
  }
  if (code === "weak_password" || message.includes("password")) {
    return {
      error: "Het wachtwoord voldoet niet aan de beveiligingsvereisten. Kies een sterker wachtwoord en probeer opnieuw.",
      code: "weak_password"
    };
  }
  if (code === "signup_disabled" || message.includes("signups not allowed") || message.includes("signup is disabled")) {
    return {
      error: "Nieuwe registraties zijn momenteel uitgeschakeld. Neem contact op met de beheerder.",
      code: "signup_disabled"
    };
  }
  if (code === "captcha_failed" || message.includes("captcha")) {
    return {
      error: "De beveiligingscontrole is mislukt. Vernieuw de pagina en probeer opnieuw.",
      code: "captcha_failed"
    };
  }
  return {
    error: "Registratie is mislukt door een technische fout bij de authenticatieservice. Probeer opnieuw; blijft dit gebeuren, meld foutcode signup_auth_error aan de beheerder.",
    code: code || "signup_auth_error"
  };
}
async function signUp(formData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirm_password") || "");
  const fullName = String(formData.get("full_name") || "").trim() || extractName(email);
  if (!email || !password)
    return { error: "E-mail en wachtwoord zijn verplicht." };
  if (!fullName || fullName.length > 200)
    return { error: "Volledige naam moet tussen 1 en 200 tekens bevatten." };
  const passwordError = passwordPolicyMessage(password);
  if (passwordError)
    return { error: passwordError };
  if (confirmPassword && password !== confirmPassword)
    return { error: "Wachtwoorden komen niet overeen." };
  const origin = appOrigin(formData.get("_callback_origin"));
  if (!origin)
    return { error: "De applicatieconfiguratie is onvolledig. Neem contact op met de beheerder." };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${origin}/auth/callback`, data: { full_name: fullName, pwa_install_prompt_pending: true } } });
  if (error)
    return signUpError(error);
  return {
    success: true,
    redirectTo: data.session ? "/pending-approval" : "/verify-email",
    userId: data.user?.id
  };
}
async function signIn(formData) {
  const submittedEmail = String(formData.get("email") || "").trim().toLowerCase();
  const email = resolveLoginEmail(submittedEmail);
  const password = String(formData.get("password") || "");
  const requestedPortal = String(formData.get("portal") || "staff").toLowerCase();
  if (!["staff", "responsible", "admin", "promotion", "administration"].includes(requestedPortal))
    return { error: "Ongeldig inlogportaal.", code: "invalid_portal" };
  if (!submittedEmail || !password)
    return { error: "E-mail en wachtwoord zijn verplicht." };
  const supabase = await createClient();
  const securityRelevant = true;
  let security = securityRelevant ? await requestSecurityContext() : null;
  const getSecurity = async () => {
    if (!security)
      security = await requestSecurityContext();
    return security;
  };
  const notifySecurity = async (outcome, reason) => {
    if (!securityRelevant)
      return;
    const context = await getSecurity();
    await sendSecurityLoginEmail({
      outcome,
      login: submittedEmail,
      canonicalLogin: email,
      portal: requestedPortal === "promotion" ? "staff" : requestedPortal === "administration" ? "admin" : requestedPortal,
      ip: context.ip,
      approximateLocation: context.approximateLocation,
      userAgent: context.userAgent,
      reason: reason ?? null
    });
  };
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    const status = error?.status ?? 0;
    const authCode = String(error?.code || "").toLowerCase();
    if (status === 429 || authCode.includes("rate_limit")) {
      return { error: "De aanmeldservice ontvangt tijdelijk te veel aanvragen. Probeer over enkele minuten opnieuw.", code: "auth_rate_limited" };
    }
    if (status >= 500 || /network|fetch failed|timed? out|connection|context canceled/i.test(error?.message || "")) {
      return { error: "De aanmeldservice is tijdelijk niet bereikbaar. Probeer opnieuw zodra de verbinding hersteld is.", code: "auth_temporarily_unavailable" };
    }
    await notifySecurity("failure", error?.message.includes("Email not confirmed") ? "email_not_confirmed" : error?.message.includes("Invalid login credentials") ? "invalid_credentials" : "auth_failure");
    if (requestedPortal === "admin" || requestedPortal === "responsible")
      return { error: "Foute logingegevens of u heeft geen toegang tot deze rol.", code: "invalid_credentials_or_role" };
    if (error?.message.includes("Email not confirmed"))
      return { error: "Verifieer eerst je e-mailadres.", code: "email_not_confirmed" };
    if (error?.message.includes("Invalid login credentials"))
      return { error: "Onjuist e-mailadres of wachtwoord.", code: "invalid_credentials" };
    return { error: "Aanmelden mislukt. Probeer opnieuw." };
  }
  const [{ data: profileRows, error: profileError }, { data: isOwner, error: ownerError }] = await Promise.all([
    supabase.rpc("upt_current_profile"),
    supabase.rpc("upt_current_is_owner")
  ]);
  const profile = profileRows?.[0] ?? null;
  if (ownerError) {
    await notifySecurity("denied", "owner_lookup_error");
    await supabase.auth.signOut();
    return { error: "Makerrechten konden niet worden gecontroleerd. Probeer opnieuw.", code: "owner_lookup_error" };
  }
  if (profileError || !profile) {
    await notifySecurity("denied", "profile_error");
    await supabase.auth.signOut();
    return { error: "Je profiel kon niet worden geladen. Probeer opnieuw.", code: "profile_error" };
  }
  if (profile.account_blocked && isOwner !== true) {
    await notifySecurity("denied", "account_blocked");
    await supabase.auth.signOut();
    return { error: "ACCOUNT GEBLOKKEERD", code: "account_blocked" };
  }
  if (!profile.approved && isOwner !== true) {
    await notifySecurity("denied", "account_not_approved");
    if (requestedPortal === "staff") {
      return { success: true, redirectTo: "/pending-approval", code: "account_not_approved" };
    }
    await supabase.auth.signOut();
    return { error: "ACCOUNT NOG NIET GOEDGEKEURD", code: "account_not_approved" };
  }
  const role = profile.role;
  const hasPermanentAdminAccess = isOwner === true || profile.approved === true && role === "admin";
  let assignedPortalAccess = false;
  if ((requestedPortal === "promotion" || requestedPortal === "administration") && !hasPermanentAdminAccess) {
    const { data: assignments, error: assignmentError } = await supabase.rpc("upt_my_portal_assignments");
    if (assignmentError) {
      await notifySecurity("denied", "portal_access_unavailable");
      await supabase.auth.signOut();
      return { error: "Aanmelden mislukt. Probeer opnieuw.", code: "portal_access_unavailable" };
    }
    assignedPortalAccess = (assignments ?? []).some((entry) => entry.portal === requestedPortal && entry.approved && !entry.revoked_at && (requestedPortal === "promotion" ? ["promoter", "admin"].includes(entry.role) : ["administrative_staff", "admin"].includes(entry.role)));
  }
  const allowed = requestedPortal === "promotion" || requestedPortal === "administration" ? assignedPortalAccess || hasPermanentAdminAccess : requestedPortal === "admin" ? hasPermanentAdminAccess : requestedPortal === "responsible" ? role === "responsible_lead" || hasPermanentAdminAccess : role === "staff" || role === "responsible_lead" || hasPermanentAdminAccess;
  if (!allowed) {
    await notifySecurity("denied", "wrong_portal");
    await supabase.auth.signOut();
    return { error: requestedPortal === "admin" || requestedPortal === "responsible" ? "Foute logingegevens of u heeft geen toegang tot deze rol." : "Dit account heeft geen toegang tot het gekozen portaal.", code: "wrong_portal" };
  }
  if (hasPermanentAdminAccess) {
    const requestedRoleMode = requestedPortal === "admin" || requestedPortal === "administration" ? "admin" : requestedPortal === "responsible" ? "responsible_lead" : "staff";
    const { data: roleMode, error: roleModeError } = await supabase.rpc("upt_set_admin_role_mode", { p_role: requestedRoleMode });
    if (roleModeError || roleMode !== requestedRoleMode) {
      await notifySecurity("denied", "role_mode_error");
      await supabase.auth.signOut();
      return { error: "De gekozen rolweergave kon niet worden geactiveerd.", code: "role_mode_error" };
    }
  }
  if (requestedPortal === "admin") {
    const context = await getSecurity();
    await adminSecurityRpc(supabase, "upt_admin_login_success", { p_login: email, p_ip: context.ip ?? null, p_location: context.approximateLocation ?? null, p_user_agent: context.userAgent ?? null });
  }
  await notifySecurity("success", "login_success");
  const workspace = requestedPortal === "administration" || requestedPortal === "promotion" ? requestedPortal : requestedPortal === "admin" ? "admin" : "events";
  (await cookies3()).set("uptilldawn-last-workspace", data.user.id + ":" + workspace, { path: "/", sameSite: "lax", secure: __nativeEnvironment3().NODE_ENV === "production", maxAge: 60 * 60 * 24 * 90 });
  const redirectTo = isOwner === true ? requestedPortal === "promotion" || requestedPortal === "administration" ? "/portals/" + requestedPortal : `/maker-mode?portal=${requestedPortal}` : requestedPortal === "promotion" || requestedPortal === "administration" ? "/portals/" + requestedPortal : requestedPortal === "admin" ? "/admin" : "/";
  return { success: true, redirectTo };
}
async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const cookieStore = await cookies3();
  cookieStore.delete("uptilldawn-admin-edit-mode");
  cookieStore.delete("uptilldawn-admin-edit-role");
  cookieStore.delete("uptilldawn-last-workspace");
  cookieStore.delete("uptilldawn-last-portal");
  redirect("/login");
}
async function forgotPassword(formData) {
  const submittedEmail = String(formData.get("email") || "").trim().toLowerCase();
  if (!submittedEmail)
    return { error: "Vul je e-mailadres in." };
  const email = resolveLoginEmail(submittedEmail);
  const origin = appOrigin(formData.get("_callback_origin"));
  if (!origin)
    return { error: "De applicatieconfiguratie is onvolledig. Neem contact op met de beheerder." };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback?next=/auth/reset-password` });
  if (error) {
    if (error.status === 429 || error.code === "over_email_send_rate_limit" || error.message.toLowerCase().includes("rate limit")) {
      return { error: "Er is zojuist al een herstelmail verstuurd. Wacht even en gebruik de meest recente herstelmail in je inbox." };
    }
    return { error: "De herstelmail kon niet worden verstuurd. Probeer het later opnieuw." };
  }
  return { success: true, message: "Als dit account bestaat, is een herstel-link naar het e-mailadres verstuurd." };
}
async function updatePassword(formData) {
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirm_password") || "");
  if (password !== confirmPassword)
    return { error: "Wachtwoorden komen niet overeen." };
  const passwordError = passwordPolicyMessage(password);
  if (passwordError)
    return { error: passwordError };
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user)
    return { error: "De herstel-link is ongeldig of verlopen. Vraag een nieuwe herstel-link aan." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password" || error.message.toLowerCase().includes("different from the old password")) {
      return { error: "Je nieuwe wachtwoord moet verschillen van je huidige wachtwoord." };
    }
    if (error.code === "weak_password") {
      return { error: "Dit wachtwoord wordt door de beveiligingsregels geweigerd. Kies een sterker en uniek wachtwoord." };
    }
    return { error: "Het wachtwoord kon niet worden gewijzigd. Probeer opnieuw." };
  }
  const { error: signOutError } = await supabase.auth.signOut({ scope: "global" });
  if (signOutError)
    await supabase.auth.signOut({ scope: "local" });
  const cookieStore = await cookies3();
  cookieStore.delete("uptilldawn-admin-edit-mode");
  cookieStore.delete("uptilldawn-admin-edit-role");
  await markSaveSuccess();
  return { success: true, message: "Wachtwoord is bijgewerkt. Log opnieuw in." };
}
async function resendVerificationEmail(formData) {
  const submittedEmail = String(formData.get("email") || "").trim().toLowerCase();
  if (!submittedEmail)
    return { error: "Vul je e-mailadres in." };
  const email = resolveLoginEmail(submittedEmail);
  const origin = appOrigin(formData.get("_callback_origin"));
  if (!origin)
    return { error: "De applicatieconfiguratie is onvolledig. Neem contact op met de beheerder." };
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${origin}/auth/callback` } });
  if (error)
    return { error: "De verificatiemail kon niet worden verstuurd. Probeer opnieuw." };
  return { success: true, message: "Verificatiemail opnieuw verstuurd." };
}
var getCurrentUser = cache2(async function getCurrentUser2() {
  const hasSessionCookie = (await cookies3()).getAll().some((cookie) => /^sb-[a-z0-9]+-auth-token(?:\.\d+)?$/i.test(cookie.name) && cookie.value.length > 0);
  if (!hasSessionCookie)
    return null;
  const supabase = await createClient();
  const readContext = supabase.rpc.bind(supabase);
  const { data: records, error } = await readContext("upt_current_session_context");
  const profile = records?.[0] ?? null;
  if (error || !profile || !profile.id || !["staff", "responsible_lead", "admin"].includes(profile.role))
    return null;
  const { verified_email: verifiedEmail, is_owner: ownerFlag, effective_role: trustedEffectiveRole, ...publicProfile } = profile;
  const realRole = publicProfile.role;
  const isOwner = ownerFlag === true;
  if (profile.account_blocked && !isOwner)
    return null;
  if (!profile.approved && !isOwner)
    return null;
  const hasPermanentAdminAccess = realRole === "admin" || isOwner;
  const storedRole = hasPermanentAdminAccess ? trustedEffectiveRole : realRole;
  const effectiveRole = storedRole === "responsible_lead" ? "responsible_lead" : storedRole === "staff" ? "staff" : storedRole === "admin" ? "admin" : realRole;
  const roles = [effectiveRole === "staff" ? "employee" : effectiveRole];
  return {
    ...publicProfile,
    approved: profile.approved || isOwner,
    role: effectiveRole,
    realRole,
    roleMode: effectiveRole,
    id: profile.id,
    email: verifiedEmail || "",
    roles,
    isAdmin: effectiveRole === "admin",
    realIsAdmin: hasPermanentAdminAccess,
    isOwner,
    isEditMode: false
  };
});

// lib/bounded-form-data.ts
async function readBoundedFormData(request, maxBytes = 16384) {
  const type = request.headers.get("content-type") || "";
  if (!type.toLowerCase().startsWith("multipart/form-data;"))
    throw new Error("invalid_form");
  const declared = request.headers.get("content-length");
  if (declared !== null) {
    const length = Number(declared);
    if (!Number.isSafeInteger(length) || length < 0)
      throw new Error("invalid_form");
    if (length > maxBytes)
      throw new Error("too_large");
  }
  const reader = request.body?.getReader();
  if (!reader)
    throw new Error("invalid_form");
  const chunks = [];
  let total = 0;
  try {
    for (; ; ) {
      const part = await reader.read();
      if (part.done)
        break;
      total += part.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {
        });
        throw new Error("too_large");
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return await new Request(request.url, {
      method: "POST",
      headers: { "content-type": type },
      body: bytes
    }).formData();
  } catch {
    throw new Error("invalid_form");
  }
}

// app/api/auth/portal-login/route.ts
var dynamic = "force-dynamic";
var NO_STORE = { "Cache-Control": "private, no-store" };
function reject(status, code) {
  return NextResponse.json({ error: "Aanmelden kon niet worden verwerkt.", code }, { status, headers: NO_STORE });
}
async function POST(request) {
  const origin = request.headers.get("origin");
  const expected = new URL(request.url).origin;
  const fetchSite = request.headers.get("sec-fetch-site");
  if (origin !== expected || fetchSite && fetchSite !== "same-origin")
    return reject(403, "invalid_origin");
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;"))
    return reject(415, "invalid_content_type");
  const length = Number(request.headers.get("content-length") || 0);
  if (!Number.isFinite(length) || length > 16384)
    return reject(413, "form_too_large");
  let form;
  try {
    form = await readBoundedFormData(request, 16384);
  } catch (error) {
    return error instanceof Error && error.message === "too_large" ? reject(413, "form_too_large") : reject(400, "invalid_form");
  }
  try {
    const portal = String(form.get("portal") ?? "");
    if (!["staff", "responsible", "promotion", "administration", "admin"].includes(portal))
      return reject(403, "invalid_portal");
    const username = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    if (username.length > 320 || password.length > 1024)
      return reject(413, "form_too_large");
    const result = await signIn(form);
    return NextResponse.json(result, { headers: NO_STORE });
  } catch {
    return reject(503, "login_temporarily_unavailable");
  }
}

// app/api/auth/account-action/route.ts
var route_exports2 = {};
__export(route_exports2, {
  POST: () => POST2,
  dynamic: () => dynamic2
});
import { nativeEnvironment as __nativeEnvironment4 } from "./native-auth-context.ts";
import { NextResponse as NextResponse2 } from "./native-auth-context.ts";
import { isRedirectError } from "./native-auth-context.ts";
var dynamic2 = "force-dynamic";
var NO_STORE2 = { "Cache-Control": "private, no-store" };
var actions = { signUp, forgotPassword, updatePassword, resendVerificationEmail };
function reject2(status, code) {
  return NextResponse2.json({ error: "De aanvraag kon niet worden verwerkt.", code }, { status, headers: NO_STORE2 });
}
async function POST2(request) {
  const expected = new URL(request.url).origin;
  const site = request.headers.get("sec-fetch-site");
  if (request.headers.get("origin") !== expected || site && site !== "same-origin")
    return reject2(403, "invalid_origin");
  if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("multipart/form-data;"))
    return reject2(415, "invalid_content_type");
  let form;
  try {
    form = await readBoundedFormData(request, 16384);
  } catch (error) {
    return reject2(error instanceof Error && error.message === "too_large" ? 413 : 400, "invalid_form");
  }
  const action = String(form.get("_action") || "");
  if (action !== "signOut" && !Object.hasOwn(actions, action))
    return reject2(400, "invalid_action");
  for (const [, value] of form)
    if (typeof value !== "string" || value.length > 2048)
      return reject2(413, "invalid_form");
  if (form.get("_callback_origin") === "https://uptilldawn-modern-main.uptilldawn.workers.dev" && ["signUp", "forgotPassword", "resendVerificationEmail"].includes(action) && __nativeEnvironment4().UPT_MIGRATION_EMAIL_CALLBACK_READY !== "true")
    return reject2(503, "email_callback_not_verified");
  try {
    if (action === "signOut") {
      try {
        await signOut();
      } catch (error) {
        if (!isRedirectError(error))
          throw error;
      }
      return NextResponse2.json({ success: true, redirectTo: "/login" }, { headers: NO_STORE2 });
    }
    return NextResponse2.json(await actions[action](form), { headers: NO_STORE2 });
  } catch {
    return reject2(503, "auth_temporarily_unavailable");
  }
}

// app/auth/callback/route.ts
var route_exports3 = {};
__export(route_exports3, {
  GET: () => GET
});
import { NextResponse as NextResponse3 } from "./native-auth-context.ts";
var EMAIL_OTP_TYPES = /* @__PURE__ */ new Set([
  "email",
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change"
]);
function safeInternalPath(value, fallback = "/") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\"))
    return fallback;
  return value;
}
async function GET(request) {
  const params = request.nextUrl.searchParams;
  const supabase = await createClient();
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const rawType = params.get("type");
  const type = rawType && EMAIL_OTP_TYPES.has(rawType) ? rawType : null;
  let error = params.get("error");
  if (!error && code) {
    ;
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (!error && tokenHash && type) {
    ;
    ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }));
  } else {
    error = true;
  }
  const requested = safeInternalPath(params.get("next"));
  const isRecovery = type === "recovery" || params.get("next") === "/auth/reset-password";
  if (error) {
    const target = isRecovery ? "/forgot-password?error=invalid_or_expired" : "/verify-email?error=De%20link%20is%20ongeldig%20of%20verlopen.";
    return NextResponse3.redirect(new URL(target, request.nextUrl.origin));
  }
  if (isRecovery) {
    return NextResponse3.redirect(new URL("/auth/reset-password", request.nextUrl.origin));
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("approved,account_blocked").eq("id", user.id).single();
    if (profile?.account_blocked) {
      return NextResponse3.redirect(new URL("/disabled", request.nextUrl.origin));
    }
    if (profile && !profile.approved) {
      return NextResponse3.redirect(new URL("/pending-approval", request.nextUrl.origin));
    }
  }
  return NextResponse3.redirect(new URL(requested, request.nextUrl.origin));
}

// <stdin>
async function executeOriginalAuth(request) {
  const path = new URL(request.url).pathname;
  if (path === "/api/auth/portal-login") {
    const handler = route_exports[request.method];
    return handler ? handler(request) : Response.json({ error: "method_not_allowed" }, { status: 405 });
  }
  if (path === "/api/auth/account-action") {
    const handler = route_exports2[request.method];
    return handler ? handler(request) : Response.json({ error: "method_not_allowed" }, { status: 405 });
  }
  if (path === "/auth/callback") {
    const handler = route_exports3[request.method];
    return handler ? handler(request) : Response.json({ error: "method_not_allowed" }, { status: 405 });
  }
  return Response.json({ error: "not_found" }, { status: 404 });
}
export {
  executeOriginalAuth
};
