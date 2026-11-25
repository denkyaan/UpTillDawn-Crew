"use client"

import { useState, useSyncExternalStore, useTransition } from "react"
import Link from "next/link"
import Image from "next/image"
import { Menu, X, Eye, EyeOff, Loader2, AlertCircle, ArrowRight, ShieldCheck, Users, UserCog, Megaphone, BriefcaseBusiness } from "lucide-react"
import { LanguageSwitcher } from "@/components/language-switcher"
import {initialUiLocale} from "@/lib/locale-preferences"

const portals = {
  staff: { label: "Personeel", icon: Users },
  responsible: { label: "Verantwoordelijke", icon: UserCog },
  admin: { label: "Beheerder", icon: ShieldCheck },
  promotion: { label: "Promotie", icon: Megaphone },
  administration: { label: "Administratie", icon: BriefcaseBusiness },
} as const

// Stable hydration snapshots mark when the login submit handler is attached.
// Unlike effect-driven state setters this is safe with the React hooks lint rules.
const subscribeHydration = () => () => {}
const clientHydrationSnapshot = () => true
const serverHydrationSnapshot = () => false

type Portal = keyof typeof portals

// A failed transport (including Cloudflare 503/1102) is never evidence of
// invalid credentials or a denied role. Keep this safe message local to the
// browser language; provider/API error bodies are never shown to users.
const loginServiceUnavailable={
  nl:"De aanmeldservice is tijdelijk niet bereikbaar. Probeer opnieuw.",
  fr:"Le service de connexion est temporairement indisponible. Réessayez.",
  en:"The sign-in service is temporarily unavailable. Please try again.",
  de:"Der Anmeldedienst ist vorübergehend nicht erreichbar. Bitte erneut versuchen.",
} as const
const loginRequestRejected={
  nl:"De aanmelding kon niet worden verwerkt. Vernieuw de pagina en probeer opnieuw.",
  fr:"La demande de connexion n'a pas pu être traitée. Actualisez la page et réessayez.",
  en:"The sign-in request could not be processed. Refresh the page and try again.",
  de:"Die Anmeldung konnte nicht verarbeitet werden. Laden Sie die Seite neu und versuchen Sie es erneut.",
} as const

function temporaryLoginError(code="auth_temporarily_unavailable"){
  return {error:loginServiceUnavailable[initialUiLocale()],code}
}

// Static Cloudflare login shells must not submit Next Server Actions back to
// their asset URL. Use a dedicated same-origin JSON handler for all login
// portals, including Admin; the handler delegates to the existing verified signIn action so
// access, ownership, audit mail and Supabase session rules remain unchanged.
async function signInFromStaticShell(formData:FormData):Promise<{
  error?:string;code?:string;success?:boolean;redirectTo?:string
}> {
  const response=await fetch('/api/auth/portal-login',{
    method:'POST',
    credentials:'same-origin',
    cache:'no-store',
    headers:{Accept:'application/json'},
    body:formData,
  })
  if(response.status===429)return temporaryLoginError("auth_rate_limited")
  if(response.status>=500)return temporaryLoginError()
  if(!response.ok)return {
    error:loginRequestRejected[initialUiLocale()],
    code:"login_request_rejected",
  }
  return await response.json()
}

export function LoginForm({
  portal,
  nativeAction,
  initialError = null,
}: {
  portal: Portal
  nativeAction?: string
  initialError?: string | null
}) {
  const PortalIcon = portals[portal].icon
  const [menuOpen, setMenuOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  const [errorCode, setErrorCode] = useState<string | null>(initialError ? "initial_login_error" : null)
  const [initialErrorDismissed, setInitialErrorDismissed] = useState(false)
  const [isPending, startTransition] = useTransition()
  const hydrated = useSyncExternalStore(subscribeHydration, clientHydrationSnapshot, serverHydrationSnapshot)
  // Preserve the existing /login/admin?error=... status after removing
  // request-bound SSR. The URL contains only a public error code, never a
  // session or an authentication result. It is read after hydration.
  const queryError = useSyncExternalStore(
    subscribeHydration,
    () => portal === "admin" ? new URLSearchParams(window.location.search).get("error") : null,
    () => null,
  )
  const displayedError = error ?? (!initialErrorDismissed ? (initialError ?? queryError) : null)
  const displayedCode = error ? errorCode : displayedError ? "initial_login_error" : null

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setErrorCode(null)
    setInitialErrorDismissed(true)
    const formData = new FormData(e.currentTarget)
    const requestedNext = new URLSearchParams(window.location.search).get("next")
    if (requestedNext && requestedNext.startsWith("/") && !requestedNext.startsWith("//") && !requestedNext.includes("\\")) {
      formData.set("next", requestedNext)
      window.sessionStorage.setItem("uptilldawn-return-after-login", requestedNext)
    } else {
      window.sessionStorage.removeItem("uptilldawn-return-after-login")
    }
    startTransition(async () => {
      try {
        const result = await signInFromStaticShell(formData)
        if (result?.error) {
          setError(result.error)
          setErrorCode(result.code || "login_denied")
          return
        }
        if (result?.success && result.redirectTo) {
          window.location.assign(result.redirectTo)
        }
      } catch {
        // Network, malformed upstream response or an unavailable Worker must
        // never be presented as invalid credentials or rejected role access.
        // Neither authorization state nor passwords are inferred on transport failure.
        const outage=temporaryLoginError()
        setErrorCode(outage.code)
        setError(outage.error)
      }
    })
  }

  return (
    <main data-auth-portal="true" className="auth-portal-screen min-h-screen bg-black text-white relative overflow-hidden">
      <button
        type="button"
        aria-label="Open inlogmenu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(v => !v)}
        className="fixed left-5 top-5 z-50 grid h-12 w-12 place-items-center rounded-xl border border-white/15 bg-black/70 backdrop-blur hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white"
      >
        {menuOpen ? <X className="h-7 w-7" /> : <Menu className="h-7 w-7" />}
      </button>

      {menuOpen && (
        <div className="auth-portal-menu fixed left-5 top-20 z-50 w-64 rounded-2xl border border-white/15 bg-zinc-950/95 p-2 shadow-2xl backdrop-blur-xl">
          <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Evenementen</p>
          {(['staff', 'responsible'] as const).map(key => {
            const Icon = portals[key].icon
            return <Link prefetch={false} key={key} href={`/login/${key}`} onClick={() => setMenuOpen(false)} aria-current={portal === key ? 'page' : undefined} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition ${portal === key ? 'bg-white text-black' : 'text-white hover:bg-white/10'}`}><Icon className="h-5 w-5" />{portals[key].label}</Link>
          })}
          <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Promotie</p>
          <Link prefetch={false} href="/login/promotion" onClick={() => setMenuOpen(false)} aria-current={portal === 'promotion' ? 'page' : undefined} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition ${portal === 'promotion' ? 'bg-white text-black' : 'text-white hover:bg-white/10'}`}><Megaphone className="h-5 w-5" />Promotie</Link>
          <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">{portals.admin.label} / {portals.administration.label}</p>
          {(['admin', 'administration'] as const).map(key => {
            const Icon = portals[key].icon
            return <Link prefetch={false} key={key} href={`/login/${key}`} onClick={() => setMenuOpen(false)} aria-current={portal === key ? 'page' : undefined} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition ${portal === key ? 'bg-white text-black' : 'text-white hover:bg-white/10'}`}><Icon className="h-5 w-5" />{portals[key].label}</Link>
          })}
        </div>
      )}

      <div className="auth-portal-content mx-auto flex min-h-screen w-full max-w-lg flex-col items-center px-6 pb-10 pt-20 sm:pt-12">
        <div className="auth-portal-logo-frame flex min-h-[260px] w-full items-center justify-center sm:min-h-[330px]">
          <Image src="/uptilldawn-logo.jpeg" alt="Up Till Dawn personeel" width={500} height={320} priority className="auth-portal-logo max-h-[320px] w-full max-w-[500px] object-contain" />
        </div>

        <section className="auth-portal-card w-full rounded-3xl border border-white/15 bg-zinc-950 p-6 shadow-2xl sm:p-8">
          <div className="auth-portal-heading mb-7 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5">
              <PortalIcon className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-black tracking-tight">{portals[portal].label}</h1>
            <p className="mt-1 text-sm text-zinc-400">UP TILL DAWN PERSONEELSBEHEER</p>
          </div>

          {displayedError && (
            <div role="alert" data-login-error-code={displayedCode || "login_error"} className="mb-5 flex gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-200">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">{displayedError}</p>
            </div>
          )}

          <form
            data-login-hydrated={hydrated ? "true" : "false"}
            action={nativeAction}
            method="post"
            onSubmit={nativeAction ? undefined : handleSubmit}
            className="space-y-5"
          >
            <input type="hidden" name="portal" value={portal} />
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-semibold">Login</label>
              <input id="email" name="email" type="text" inputMode="email" autoComplete="username" required placeholder="naam@email.com" className="h-12 w-full rounded-xl border border-white/15 bg-black px-4 text-white outline-none placeholder:text-zinc-600 focus:border-white/50" />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-semibold">Wachtwoord</label>
                <Link href="/forgot-password" className="text-xs text-zinc-400 hover:text-white">Wachtwoord vergeten?</Link>
              </div>
              <div className="relative">
                <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required placeholder="••••••••" className="h-12 w-full rounded-xl border border-white/15 bg-black px-4 pr-12 text-white outline-none placeholder:text-zinc-600 focus:border-white/50" />
                <button type="button" aria-label={showPassword ? "Verberg wachtwoord" : "Toon wachtwoord"} onPointerDown={event => { if (event.pointerType === "touch") event.preventDefault() }} onClick={() => setShowPassword(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white">
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <button disabled={isPending} type="submit" className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white font-black text-black transition hover:bg-zinc-200 disabled:opacity-60">
              {isPending ? <><Loader2 className="h-5 w-5 animate-spin" />Inloggen…</> : <>Inloggen<ArrowRight className="h-5 w-5" /></>}
            </button>
          </form>

          <div className="auth-portal-register mt-6 border-t border-white/10 pt-5 text-center text-sm text-zinc-400">
            Nog geen account? <Link href="/signup" className="font-bold text-white hover:underline">Account aanmaken</Link>
          </div>
        </section>
        <div className="auth-portal-language mt-6 w-full rounded-2xl border border-white/10 bg-zinc-950/70 p-4"><LanguageSwitcher dark /></div>
      </div>
    </main>
  )
}
