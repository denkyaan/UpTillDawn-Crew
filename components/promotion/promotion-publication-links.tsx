import {Facebook,Instagram} from 'lucide-react'
import {promotionPublicationLinks} from '@/lib/promotion-publication-links'

export function PromotionPublicationLinks({description}:{description:string}){
 const links=promotionPublicationLinks(description)
 if(!links.length)return null
 return <div className="mt-3 flex flex-wrap gap-2">{links.map(link=><a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" title={link.url} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold text-violet-400">
  {link.platform==='instagram'?<Instagram className="size-4" aria-hidden="true"/>:<Facebook className="size-4" aria-hidden="true"/>}
  {link.platform==='instagram'?'Instagram':'Facebook'}
 </a>)}</div>
}
