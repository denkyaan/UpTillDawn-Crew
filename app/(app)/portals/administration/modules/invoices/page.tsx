import AdministrationModulePage from "../[slug]/page"

export const dynamic = "force-dynamic"

// Preserve query filters and pagination when routing through the static module page.
type ModuleSearchParams = {
 event?: string
 page?: string
 invoiceKind?: string
 invoiceStatus?: string
 invoicePage?: string
 invoiceNumber?: string
 invoiceFrom?: string
 invoiceTo?: string
 invoiceOverdue?: string
 invoiceSort?: string
}

export default function Page({searchParams}:{searchParams:Promise<ModuleSearchParams>}){
 return AdministrationModulePage({params:Promise.resolve({slug:"invoices"}),searchParams})
}
