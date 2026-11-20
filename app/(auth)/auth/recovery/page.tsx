import Image from 'next/image'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function RecoveryGatePage({ searchParams }: Props) {
  const params = await searchParams
  const tokenHash = typeof params.token_hash === 'string' ? params.token_hash : ''
  const type = typeof params.type === 'string' ? params.type : 'recovery'

  if (!tokenHash || type !== 'recovery') {
    return (
      <Card className="w-full max-w-md rounded-2xl border-border shadow-lg">
        <CardHeader className="items-center space-y-4 pb-2">
          <Image src="/up-till-dawn-mark.webp" alt="UP TILL DAWN" width={48} height={48} className="h-12 w-12 rounded-xl object-cover" />
          <h1 className="text-xl font-bold">Ongeldige herstel-link</h1>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center">
            Deze herstel-link is onvolledig. Vraag een nieuwe wachtwoordherstelmail aan.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md rounded-2xl border-border shadow-lg">
      <CardHeader className="items-center space-y-4 pb-2">
        <Image src="/up-till-dawn-mark.webp" alt="UP TILL DAWN" width={48} height={48} className="h-12 w-12 rounded-xl object-cover" />
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-bold">Wachtwoord herstellen</h1>
          <p className="text-sm text-muted-foreground">
            Bevestig hieronder dat je je wachtwoord wilt wijzigen.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <form action="/auth/callback" method="get" className="space-y-4">
          <input type="hidden" name="token_hash" value={tokenHash} />
          <input type="hidden" name="type" value="recovery" />
          <input type="hidden" name="next" value="/auth/reset-password" />
          <Button type="submit" className="h-11 w-full rounded-xl">
            Wachtwoord herstellen
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          De beveiligde herstelcode wordt pas gebruikt wanneer je op deze knop klikt.
        </p>
      </CardContent>
    </Card>
  )
}
