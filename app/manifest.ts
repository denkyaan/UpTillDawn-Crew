import type { MetadataRoute } from 'next'
import { PRODUCT_COPY, requestUiLocale } from '@/lib/server-locale'

export const dynamic='force-dynamic'

export default async function manifest():Promise<MetadataRoute.Manifest>{
  const locale=await requestUiLocale()
  const copy=PRODUCT_COPY[locale]
  return {
    id:'/',
    name:copy.manifestName,
    short_name:'UP TILL DAWN',
    description:copy.manifestDescription,
    start_url:'/',
    scope:'/',
    display:'standalone',
    background_color:'#050505',
    theme_color:'#050505',
    icons:[{src:'/up-till-dawn-mark.webp',sizes:'216x216',type:'image/webp'}],
  }
}
