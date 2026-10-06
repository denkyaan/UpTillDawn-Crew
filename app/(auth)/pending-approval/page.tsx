import { redirect } from 'next/navigation'
import { Clock3, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/crew-server'
import { signOut } from '@/lib/actions/auth'
import { requestUiLocale } from '@/lib/server-locale'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const COPY = {
  nl: {
    heading: 'Account wacht op goedkeuring',
    body: 'Je registratie is voltooid. Een beheerder moet je account nog goedkeuren voordat je het crewplatform kunt gebruiken.',
    info: 'Je hoeft geen nieuw account te maken. Zodra je account is goedgekeurd, krijg je bij je volgende bezoek automatisch toegang.',
    logout: 'Uitloggen',
  },
  fr: {
    heading: 'Compte en attente d’approbation',
    body: 'Votre inscription est terminée. Un administrateur doit encore approuver votre compte avant que vous puissiez utiliser la plateforme crew.',
    info: 'Vous ne devez pas créer un nouveau compte. Dès que votre compte est approuvé, vous aurez automatiquement accès lors de votre prochaine visite.',
    logout: 'Se déconnecter',
  },
  en: {
    heading: 'Account awaiting approval',
    body: 'Your registration is complete. An administrator still needs to approve your account before you can use the crew platform.',
    info: 'You do not need to create another account. Once approved, you will automatically get access on your next visit.',
    logout: 'Log out',
  },
  de: {
    heading: 'Konto wartet auf Freigabe',
    body: 'Deine Registrierung ist abgeschlossen. Ein Administrator muss dein Konto noch freigeben, bevor du die Crew-Plattform verwenden kannst.',
    info: 'Du musst kein neues Konto erstellen. Sobald dein Konto freigegeben wurde, erhältst du beim nächsten Besuch automatisch Zugriff.',
    logout: 'Abmelden',
  },
} as const

export default async function PendingApprovalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: profile }, { data: isOwner }] = await Promise.all([
    supabase.from('profiles').select('approved,account_blocked').eq('id', user.id).single(),
    supabase.rpc('upt_current_is_owner'),
  ])

  if (profile?.account_blocked) redirect('/disabled')
  if (profile?.approved || isOwner === true) redirect('/')

  const locale = await requestUiLocale()
  const copy = COPY[locale]

  return (
    <Card className="w-full max-w-md rounded-2xl border-border shadow-lg">
      <CardHeader className="items-center space-y-4 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full border bg-muted">
          <Clock3 className="h-7 w-7" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold">{copy.heading}</h1>
          <p className="text-sm text-muted-foreground">{copy.body}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex gap-3 rounded-xl border bg-muted/40 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-sm text-muted-foreground">{copy.info}</p>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="outline" className="w-full rounded-xl">
            {copy.logout}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
