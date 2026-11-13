import type {IntegrationId,IntegrationReadiness} from "./external-services-readiness"

/** Each external connection has one functional home, not a second settings directory.
 * Admin and Administration both use the same underlying encrypted connection store.
 */
export const integrationPlacement={
 contracts:["documenso"],
 invoices:["peppol"],
 banking:["banking"],
 ticketing:["weeztix","eventix"],
 sales:["sumup","eventpay"],
 documents:["cloudmersive"],
} as const satisfies Record<string,readonly IntegrationId[]>

export type IntegrationWorkspace=keyof typeof integrationPlacement

export function integrationServicesForWorkspace(workspace:string,readiness:readonly IntegrationReadiness[]):IntegrationReadiness[]{
 const ids=(integrationPlacement as Partial<Record<string,readonly IntegrationId[]>>)[workspace]??[]
 return ids.map(id=>readiness.find(service=>service.id===id)).filter((service):service is IntegrationReadiness=>Boolean(service))
}
