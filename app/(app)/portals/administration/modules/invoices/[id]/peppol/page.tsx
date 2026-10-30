import Link from 'next/link'
import {notFound} from 'next/navigation'
import PeppolPreparation from '@/components/administration/peppol-preparation'
import {administrationPageAccess} from '@/lib/administration/page-access'
import AdministrationAccessNotice from '@/components/administration/portal-access-notice'
import {requestUiLocale} from '@/lib/server-locale'
import {peppolCopy} from '@/lib/administration/peppol-copy'
import PeppolDocumentFields from '@/components/administration/peppol-document-fields'

export default async function Page({params}:{params:Promise<{id:string}>}){
 const access=await administrationPageAccess()
 if(!access.ok)return <AdministrationAccessNotice status={access.status}/>
 const {id}=await params
 if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))notFound()
 const {data}=await access.db.from('admin_financial_documents').select('id,kind,status,buyer_reference,order_reference,delivery_date,delivery_country').eq('id',id).maybeSingle()
 if(!data)notFound()
 const {data:lines,error}=await access.db.from('admin_financial_lines').select('id,description,quantity,unit_price,vat_rate,unit_code,vat_category,vat_exemption_reason').eq('document_id',id).order('created_at').order('id').limit(1001)
 const locale=await requestUiLocale()
 return <main className="mx-auto max-w-4xl space-y-5 p-4"><Link className="text-violet-400 underline" href="/portals/administration/modules/invoices">← {peppolCopy[locale].finance}</Link><PeppolPreparation documentId={id} locale={locale}/>{error?<p role="alert">{peppolCopy[locale].error}</p>:<PeppolDocumentFields document={data} lines={lines??[]} canEnrich={Boolean(access.user.isAdmin||access.user.isOwner)} locale={locale} preparationLink={false}/>}</main>
}
