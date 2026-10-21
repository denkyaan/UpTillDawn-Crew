import Link from 'next/link'
import { Users, Megaphone, ShieldCheck } from 'lucide-react'

const portals = [
  { title: 'Evenementen', description: 'Personeel en verantwoordelijken', href: '/login/staff', icon: Users },
  { title: 'Promotie', description: 'Promotieteam en campagnes', href: '/login/staff?next=%2Fportals%2Fpromotion', icon: Megaphone },
  { title: 'Admin & Administratief', description: 'Beheer en administratie', href: '/login/admin', icon: ShieldCheck },
]

export default function LoginPage() {
  return <main className="min-h-screen bg-black px-5 py-12 text-white">
    <div className="mx-auto max-w-xl space-y-7">
      <header className="text-center"><h1 className="text-3xl font-bold">Up Till Dawn Crew</h1><p className="mt-3 text-zinc-400">Kies je portaal om in te loggen</p></header>
      <nav aria-label="Portaalkeuze" className="space-y-3">{portals.map(({title,description,href,icon:Icon})=><Link key={title} href={href} className="flex items-center gap-4 rounded-2xl border border-white/20 bg-zinc-950 p-5 hover:border-violet-400 focus-visible:outline-2 focus-visible:outline-violet-400"><Icon className="h-7 w-7 shrink-0 text-violet-400" aria-hidden="true"/><span><strong className="block text-lg">{title}</strong><span className="text-sm text-zinc-400">{description}</span></span></Link>)}</nav>
      <p className="text-center text-sm text-zinc-400">Nog geen account? <Link className="text-white underline" href="/signup">Registreren</Link></p>
    </div>
  </main>
}
