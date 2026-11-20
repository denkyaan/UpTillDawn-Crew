import type {IntegrationId,IntegrationReadiness} from "./external-services-readiness"

/** Each external connection has one functional home, not a second settings directory.
 * Admin and Administration both use the same underlying encrypted connection store.
 */
export const integrationPlacement={
 contracts:["documenso"],
 invoices:["peppol"],
 // Same encrypted connection store in two role-specific workflow views.
 // Administration configures cashless readiness in Bank & payments; Head Admin
 // finds it in Sales. Never create a second merchant or EventPay wallet.
 banking:["banking","sumup","eventpay"],
 ticketing:["weeztix","eventix"],
 sales:["sumup","eventpay"],
 documents:["cloudmersive"],
} as const satisfies Record<string,readonly IntegrationId[]>

export type IntegrationWorkspace=keyof typeof integrationPlacement

export function integrationServicesForWorkspace(workspace:string,readiness:readonly IntegrationReadiness[]):IntegrationReadiness[]{
 const ids=(integrationPlacement as Partial<Record<string,readonly IntegrationId[]>>)[workspace]??[]
 return ids.map(id=>readiness.find(service=>service.id===id)).filter((service):service is IntegrationReadiness=>Boolean(service))
}
