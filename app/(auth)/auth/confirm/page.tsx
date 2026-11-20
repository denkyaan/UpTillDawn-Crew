import Image from 'next/image'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const ALLOWED_TYPES = new Set(['email', 'signup', 'invite', 'email_change', 'magiclink'])

function copyFor(type: string) {
  if (type === 'invite') {
    return {
      title: 'Uitnodiging bevestigen',
      description: 'Bevestig hieronder dat je de uitnodiging voor UpTillDawn Crew wilt accepteren.',
      button: 'Uitnodiging accepteren',
    }
  }
  if (type === 'email_change') {
    return {
      title: 'Nieuw e-mailadres bevestigen',
      description: 'Bevestig hieronder dat je je nieuwe e-mailadres wilt activeren.',
      button: 'E-mailadres bevestigen',
    }
  }
  if (type === 'magiclink') {
    return {
      title: 'Inloggen bevestigen',
      description: 'Bevestig hieronder dat je met deze beveiligde link wilt inloggen.',
      button: 'Inloggen',
    }
  }
  return {
    title: 'E-mailadres bevestigen',
    description: 'Bevestig hieronder dat je je e-mailadres voor UpTillDawn Crew wilt verifiëren.',
    button: 'E-mailadres bevestigen',
  }
}

export default async function ConfirmGatePage({ searchParams }: Props) {
  const params = await searchParams
  const tokenHash = typeof params.token_hash === 'string' ? params.token_hash : ''
  const type = typeof params.type === 'string' ? params.type : 'email'
  const next = typeof params.next === 'string' && params.next.startsWith('/') && !params.next.startsWith('//')
    ? params.next
    : '/'

  if (!tokenHash || !ALLOWED_TYPES.has(type)) {
    return (
      <Card className="w-full max-w-md rounded-2xl border-border shadow-lg">
        <CardHeader className="items-center space-y-4 pb-2">
          <Image src="/up-till-dawn-mark.webp" alt="UP TILL DAWN" width={48} height={48} className="h-12 w-12 rounded-xl object-cover" />
          <h1 className="text-xl font-bold">Ongeldige bevestigingslink</h1>
        </CardHeader>
        <CardContent>
          <p className="text-center text-sm text-muted-foreground">
            Deze bevestigingslink is onvolledig of ongeldig. Vraag indien nodig een nieuwe e-mail aan.
          </p>
        </CardContent>
      </Card>
    )
  }

  const copy = copyFor(type)

  return (
    <Card className="w-full max-w-md rounded-2xl border-border shadow-lg">
      <CardHeader className="items-center space-y-4 pb-2">
        <Image src="/up-till-dawn-mark.webp" alt="UP TILL DAWN" width={48} height={48} className="h-12 w-12 rounded-xl object-cover" />
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-bold">{copy.title}</h1>
          <p className="text-sm text-muted-foreground">{copy.description}</p>
        </div>
      </CardHeader>
      <CardContent>
        <form action="/auth/callback" method="get" className="space-y-4">
          <input type="hidden" name="token_hash" value={tokenHash} />
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="next" value={next} />
          <Button type="submit" className="h-11 w-full rounded-xl">
            {copy.button}
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          De eenmalige beveiligingscode wordt pas gebruikt wanneer je op de knop klikt.
        </p>
      </CardContent>
    </Card>
  )
}
