import Link from 'next/link'
import Image from 'next/image'
import { ShieldCheck } from 'lucide-react'
import { signInAdmin } from '@/lib/actions/auth'
import { LanguageSwitcher } from '@/components/language-switcher'

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const error = typeof params.error === 'string' ? params.error : null

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col items-center px-6 pb-10 pt-12">
        <div className="flex min-h-[260px] w-full items-center justify-center sm:min-h-[330px]">
          <Image src="/uptilldawn-logo.jpeg" alt="Up Till Dawn personeel" width={500} height={320} priority className="max-h-[320px] w-full max-w-[500px] object-contain" />
        </div>

        <section className="w-full rounded-3xl border border-white/15 bg-zinc-950 p-6 shadow-2xl sm:p-8">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-black tracking-tight">Beheerder</h1>
            <p className="mt-1 text-sm text-zinc-400">UP TILL DAWN PERSONEELSBEHEER</p>
          </div>

          {error ? (
            <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-medium text-red-200">
              {error}
            </div>
          ) : null}

          <form action={signInAdmin} className="space-y-5">
            <div>
              <label htmlFor="admin-login" className="mb-2 block text-sm font-semibold">Login</label>
              <input id="admin-login" name="email" type="text" autoComplete="username" required placeholder="maker@uptilldawn" className="h-12 w-full rounded-xl border border-white/15 bg-black px-4 text-white outline-none placeholder:text-zinc-600 focus:border-white/50" />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="admin-password" className="text-sm font-semibold">Wachtwoord</label>
                <Link href="/forgot-password" className="text-xs text-zinc-400 hover:text-white">Wachtwoord vergeten?</Link>
              </div>
              <input id="admin-password" name="password" type="password" autoComplete="current-password" required className="h-12 w-full rounded-xl border border-white/15 bg-black px-4 text-white outline-none focus:border-white/50" />
            </div>

            <button type="submit" className="h-12 w-full rounded-xl bg-white font-black text-black transition hover:bg-zinc-200">
              Inloggen
            </button>
          </form>

          <div className="mt-6 grid grid-cols-2 gap-2 border-t border-white/10 pt-5 text-center text-sm">
            <Link href="/login/staff" className="rounded-lg border border-white/10 px-3 py-2 text-zinc-300 hover:bg-white/5">Personeel</Link>
            <Link href="/login/responsible" className="rounded-lg border border-white/10 px-3 py-2 text-zinc-300 hover:bg-white/5">Verantwoordelijke</Link>
          </div>
        </section>

        <div className="mt-6 w-full rounded-2xl border border-white/10 bg-zinc-950/70 p-4">
          <LanguageSwitcher dark />
        </div>
      </div>
    </main>
  )
}
