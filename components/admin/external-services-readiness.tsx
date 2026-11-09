import type {SupportedUiLocale} from "@/lib/locale-preferences"
import {externalServicesCopy,type IntegrationReadiness} from "@/lib/administration/external-services-readiness"

export function ExternalServicesReadiness({locale,services}:{locale:SupportedUiLocale;services:IntegrationReadiness[]}){
 const t=externalServicesCopy[locale]
 return <section aria-label={t.title} className="rounded-xl border p-3 text-sm">
  <h3 className="font-bold">{t.title}</h3>
  <p className="mt-1 text-xs text-muted-foreground">{t.intro}</p>
  <div className="mt-3 grid gap-2 md:grid-cols-2">
   {services.map(service=><article key={service.id} className="min-w-0 space-y-2 rounded-xl border p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
     <strong className="text-sm">{t.names[service.id]}</strong>
     <span className="text-xs font-semibold text-muted-foreground">{t.states[service.state]}</span>
    </div>
    <p className="text-xs text-muted-foreground">{t.instructions[service.id]}</p>
    {service.setupVariables.length>0&&<p className="break-words text-[11px] text-muted-foreground">
     {service.setupVariables.map(name=><code key={name} className="mb-1 mr-1 inline-block rounded bg-muted px-1.5 py-0.5">{name}</code>)}
    </p>}
    {service.docsUrl&&<a href={service.docsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex text-xs font-medium text-violet-400 underline">{t.link}</a>}
   </article>)}
  </div>
 </section>
}
