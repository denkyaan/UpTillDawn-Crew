'use client'

import { ErrorReportButton } from '@/components/error-report-button'

export default function Error({
  error,
  reset,
}:{
  error:Error&{digest?:string}
  reset:()=>void
}){
  return <main className="space-y-4 p-8">
    <div>
      <h1 className="text-2xl font-bold">De actie kon niet worden voltooid.</h1>
      <p>Controleer je invoer en verbinding.</p>
    </div>
    <div className="flex flex-wrap gap-2">
      <button onClick={reset} className="rounded-xl border p-3">Opnieuw proberen</button>
      <ErrorReportButton
        errorMessage={error.message||'Onbekende applicatiefout'}
        errorName={error.name||'Error'}
        stackTrace={error.stack||error.digest||''}
        source="boundary"
        onRetry={reset}
        compact
      />
    </div>
  </main>
}
