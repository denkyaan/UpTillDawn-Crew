import { Suspense } from "react"
import VerifyEmailClient from "./verify-email-client"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <Card className="w-full max-w-md rounded-2xl border-border shadow-lg">
        <CardContent className="flex items-center justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    }>
      <VerifyEmailClient />
    </Suspense>
  )
}
