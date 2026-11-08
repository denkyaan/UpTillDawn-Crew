export type PromotionPublicationLink={platform:'instagram'|'facebook';url:string}

/** Public social links only; never turn arbitrary task text into an executable URL. */
export function promotionPublicationLinks(description:string):PromotionPublicationLink[]{
 const links:PromotionPublicationLink[]=[],seen=new Set<string>()
 for(const match of description.matchAll(/https?:\/\/[^\s<>"']+/gi)){
  const raw=match[0].replace(/[),.;!?]+$/g,'')
  if(raw.length>2048)continue
  try{
   const url=new URL(raw)
   if(url.username||url.password||url.port)continue
   const host=url.hostname.toLowerCase()
   const platform=host==='instagram.com'||host.endsWith('.instagram.com')?'instagram':host==='facebook.com'||host.endsWith('.facebook.com')||host==='fb.me'?'facebook':null
   if(!platform)continue
   url.protocol='https:'
   const href=url.toString()
   if(seen.has(href))continue
   seen.add(href);links.push({platform,url:href})
   if(links.length===8)break
  }catch{continue}
 }
 return links
}
