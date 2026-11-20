import Link from 'next/link'
import { getCurrentUser } from '@/lib/actions/auth'

export default async function HelpPage(){
 const user=await getCurrentUser()
 if(!user)return null
 return <main className="mx-auto max-w-4xl space-y-6 p-4 pb-28 md:p-8">
  <header><h1 className="text-3xl font-bold">Help & ondersteuning</h1><p className="mt-2 text-muted-foreground">Hulp bij het gebruik van het operationele platform.</p></header>
  <section className="grid gap-3 sm:grid-cols-2">
   <Link className="rounded-xl border p-4 hover:bg-muted" href="/events"><h2 className="font-semibold">Evenementen</h2><p className="text-sm text-muted-foreground">Beschikbaarheid en evenementinformatie.</p></Link>
   <Link className="rounded-xl border p-4 hover:bg-muted" href="/briefings"><h2 className="font-semibold">Briefings</h2><p className="text-sm text-muted-foreground">Instructies lezen en bevestigen.</p></Link>
   <Link className="rounded-xl border p-4 hover:bg-muted" href="/operations"><h2 className="font-semibold">Werkuren</h2><p className="text-sm text-muted-foreground">Aanwezigheid, pauzes en urenregistratie.</p></Link>
   <Link className="rounded-xl border p-4 hover:bg-muted" href="/settings"><h2 className="font-semibold">Instellingen</h2><p className="text-sm text-muted-foreground">Account- en appinstellingen.</p></Link>
  </section>
  <p className="text-sm text-muted-foreground">Voor vragen over een evenement kun je contact opnemen met je verantwoordelijke of een beheerder via de chat.</p>
 </main>
}
