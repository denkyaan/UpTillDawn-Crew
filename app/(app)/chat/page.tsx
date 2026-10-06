import { createClient } from '@/lib/supabase/crew-server'
import { ChatClient } from '@/components/crew/chat-client'
import { getCurrentUser } from '@/lib/actions/auth'
import { SandboxRoleModule,type TrainingRole } from '@/components/training/sandbox-role-module'

export const dynamic='force-dynamic'

export default async function Page({searchParams}:{searchParams?:Promise<{event?:string;workplace?:string;private?:string;channel?:string;tour?:string}>}){
  const params=searchParams?await searchParams:{}
  const s=await createClient();const current=await getCurrentUser();if(!current)return null
  if(params.tour==='1')return <SandboxRoleModule role={current.role as TrainingRole} module="chat"/>
  const user={id:current.id}
  const [{data:channels,error},{data:directory},{data:privatePeers},{data:activeEvents},{data:chatEvents}]=await Promise.all([
    s.from('chat_channels').select('*').in('kind',['organization','event','workplace','private']).order('created_at'),
    s.rpc('upt_crew_directory'),
    s.rpc('upt_private_chat_peers'),
    s.from('events').select('id,start_at,end_at').neq('status','archived').lte('start_at','now').gte('end_at','now').order('start_at'),
    s.from('events').select('id,start_at,end_at,status,image_url').order('start_at'),
  ])

  const profilePhotoUrls:Record<string,string>={}
  await Promise.all((directory||[]).filter(member=>member.profile_photo_url).map(async member=>{
    const {data:signed}=await s.storage.from('profile-photos').createSignedUrl(member.profile_photo_url!,3600)
    if(signed?.signedUrl)profilePhotoUrls[member.id]=signed.signedUrl
  }))

  // chat_channels is already protected by upt_can_read_channel RLS. Do not apply a
  // second assignment policy in the UI: that can only hide channels the database
  // has explicitly authorized, especially during the three-day post-event window.
  const readable=(channels||[]).filter(channel=>['organization','event','workplace','private'].includes(channel.kind))
  const ordered=[...readable].sort((a,b)=>{const weight=(kind:string)=>kind==='private'?0:kind==='organization'?1:kind==='event'?2:3;const byKind=weight(a.kind)-weight(b.kind);return byKind||(a.name||'').localeCompare(b.name||'','nl')})
  const eventImages=new Map((chatEvents||[]).map(event=>[event.id,event.image_url]))
  const privatePeerNames=Object.fromEntries((privatePeers||[]).map(peer=>[peer.channel_id,peer.full_name||'Privéchat']))
  const privatePeerIds=Object.fromEntries((privatePeers||[]).map(peer=>[peer.channel_id,peer.user_id]))
  const channelImages:Record<string,string>={}
  for(const channel of ordered){
    if(channel.kind==='organization'||(channel.kind==='private'&&channel.name==='Up Till Dawn · persoonlijk'))channelImages[channel.id]='/up-till-dawn-mark.webp'
    else if(channel.kind==='private'&&privatePeerIds[channel.id]&&profilePhotoUrls[privatePeerIds[channel.id]])channelImages[channel.id]=profilePhotoUrls[privatePeerIds[channel.id]]
    else if(channel.event_id&&eventImages.get(channel.event_id))channelImages[channel.id]=eventImages.get(channel.event_id)!
  }
  const activeIds=new Set((activeEvents||[]).map(event=>event.id))
  const defaultChannelId=
    (params.channel?ordered.find(channel=>channel.id===params.channel)?.id:null)
    ||(params.private==='1'?ordered.find(channel=>channel.kind==='private'&&channel.name==='Up Till Dawn · persoonlijk')?.id:null)
    ||(params.workplace?ordered.find(channel=>channel.kind==='workplace'&&channel.workplace_id===params.workplace)?.id:null)
    ||(params.event?ordered.find(channel=>channel.kind==='event'&&channel.event_id===params.event)?.id:null)
    ||ordered.find(channel=>channel.kind==='event'&&channel.event_id&&activeIds.has(channel.event_id))?.id
    ||ordered.find(channel=>channel.kind==='organization')?.id
    ||ordered[0]?.id
    ||''

  return <main className="mx-auto max-w-4xl p-0 pb-24 md:p-8 md:pb-8">
    {error?<p className="p-4">Gesprekken konden niet worden geladen.</p>:<ChatClient channels={ordered} defaultChannelId={defaultChannelId} userId={user.id} crewDirectory={directory||[]} isAdmin={current.role==='admin'} profilePhotoUrls={profilePhotoUrls} channelImages={channelImages} privatePeerNames={privatePeerNames}/>} 
  </main>
}
