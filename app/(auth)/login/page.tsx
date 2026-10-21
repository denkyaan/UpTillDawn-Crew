'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Users, Megaphone, ShieldCheck } from 'lucide-react'
import { LANGUAGE_APPLIED_EVENT, initialUiLocale, parseUiLocale, type SupportedUiLocale } from '@/lib/locale-preferences'
import { LanguageSwitcher } from '@/components/language-switcher'

const copy = {
  nl: { heading: 'Up Till Dawn Crew', choose: 'Kies je portaal om in te loggen', nav: 'Portaalkeuze', events: 'Evenementen', eventsDetail: 'Personeel en verantwoordelijken', promotion: 'Promotie', promotionDetail: 'Promotieteam en campagnes', admin: 'Admin & Administratief', adminDetail: 'Beheer en administratie', noAccount: 'Nog geen account?', register: 'Registreren' },
  en: { heading: 'Up Till Dawn Crew', choose: 'Choose a portal to sign in', nav: 'Portal selection', events: 'Events', eventsDetail: 'Staff and responsible leads', promotion: 'Promotion', promotionDetail: 'Promotion team and campaigns', admin: 'Admin & Administration', adminDetail: 'Management and administration', noAccount: 'No account yet?', register: 'Register' },
  fr: { heading: 'Up Till Dawn Crew', choose: 'Choisissez un portail pour vous connecter', nav: 'Choix du portail', events: 'Événements', eventsDetail: 'Personnel et responsables', promotion: 'Promotion', promotionDetail: 'Équipe promotionnelle et campagnes', admin: 'Admin et administration', adminDetail: 'Gestion et administration', noAccount: 'Pas encore de compte ?', register: 'Créer un compte' },
  de: { heading: 'Up Till Dawn Crew', choose: 'Wähle ein Portal zur Anmeldung', nav: 'Portalauswahl', events: 'Veranstaltungen', eventsDetail: 'Personal und Verantwortliche', promotion: 'Promotion', promotionDetail: 'Promotionteam und Kampagnen', admin: 'Admin und Verwaltung', adminDetail: 'Management und Verwaltung', noAccount: 'Noch kein Konto?', register: 'Registrieren' },
} as const

export default function LoginPage() {
  const [locale, setLocale] = useState<SupportedUiLocale>('nl')
  useEffect(() => {
    setLocale(initialUiLocale())
    const sync = (event: Event) => setLocale(parseUiLocale((event as CustomEvent<string>).detail) || initialUiLocale())
    window.addEventListener(LANGUAGE_APPLIED_EVENT, sync)
    return () => window.removeEventListener(LANGUAGE_APPLIED_EVENT, sync)
  }, [])
  const t = copy[locale]
  const portals = [
    { title: t.events, description: t.eventsDetail, href: '/login/staff', icon: Users },
    { title: t.promotion, description: t.promotionDetail, href: '/login/staff?next=%2Fportals%2Fpromotion', icon: Megaphone },
    { title: t.admin, description: t.adminDetail, href: '/login/admin', icon: ShieldCheck },
  ]
  return <main className="min-h-screen bg-black px-5 py-12 text-white">
    <div className="mx-auto max-w-xl space-y-7">
      <header className="text-center"><h1 className="text-3xl font-bold">{t.heading}</h1><p className="mt-3 text-zinc-400">{t.choose}</p></header>
      <nav aria-label={t.nav} className="space-y-3">{portals.map(({title,description,href,icon:Icon})=><Link key={href} href={href} className="flex items-center gap-4 rounded-2xl border border-white/20 bg-zinc-950 p-5 hover:border-violet-400 focus-visible:outline-2 focus-visible:outline-violet-400"><Icon className="h-7 w-7 shrink-0 text-violet-400" aria-hidden="true"/><span><strong className="block text-lg">{title}</strong><span className="text-sm text-zinc-400">{description}</span></span></Link>)}</nav>
      <p className="text-center text-sm text-zinc-400">{t.noAccount} <Link className="text-white underline" href="/signup">{t.register}</Link></p>
      <LanguageSwitcher dark />
    </div>
  </main>
}
