'use client'
/* eslint-disable @next/next/no-img-element */
// Regression contract: Enter = nieuwe regel · verzenden gebeurt met de knop.
import {useEffect,useMemo,useRef,useState} from 'react'
import {useRouter} from 'next/navigation'
import {Bell,ChevronDown,FileText,MessageCirclePlus,Paperclip,Phone,Pin,Search,Send,Trash2,Users,X} from 'lucide-react'
import {createClient} from '@/lib/supabase/crew-client'
import {enqueue,enqueueChatPhoto} from '@/lib/crew-queue'
import type {Database,Tables} from '@/types/crew-database'
import {liveTranslateText,type LiveTranslationLocale} from '@/lib/browser-live-translation'
import {translateRuntimeUi,translateSystemMessage} from '@/lib/ui-translation-runtime'

type CrewMember=Database['public']['Functions']['upt_crew_directory']['Returns'][number]
type ChatPerson=Database['public']['Functions']['upt_chat_channel_people']['Returns'][number]
type ChatSummary=Database['public']['Functions']['upt_chat_channel_summaries']['Returns'][number]
type ChatPin=Database['public']['Functions']['upt_chat_pins']['Returns'][number]
type ChatSearchResult=Database['public']['Functions']['upt_search_chat_messages']['Returns'][number]
type Attachment={url:string;mimeType:string|null}
type ChannelCache={messages:Tables<'messages'>[];attachments:Record<string,Attachment[]>;replyTargets:Record<string,Tables<'messages'>>;hasMore:boolean}
type MentionState={start:number;end:number;query:string}
const EMPTY_PEOPLE:ChatPerson[]=[]
const ACCEPT='image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,application/pdf,text/plain,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function ChannelAvatar({src,size='lg'}:{src?:string;size?:'sm'|'lg'}){
  const classes=size==='lg'?'h-11 w-11':'h-9 w-9'
  return <div className={`flex ${classes} shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted`}>
    {src?<img src={src} alt="" className="h-full w-full object-cover"/>:<Users className={size==='lg'?'h-5 w-5':'h-4 w-4'}/>}
  </div>
}

function AttachmentView({attachment,mine}:{attachment:Attachment;mine:boolean}){
  if(attachment.mimeType?.startsWith('video/'))return <video src={attachment.url} controls playsInline className="mt-2 max-h-80 w-full rounded-xl border border-white/15 bg-black"/>
  if(attachment.mimeType?.startsWith('image/'))return <a href={attachment.url} target="_blank" rel="noreferrer" className="mt-2 block overflow-hidden rounded-xl border border-white/15"><img src={attachment.url} alt="Chatmedia" className="max-h-80 w-full object-contain bg-black/20"/></a>
  return <a href={attachment.url} target="_blank" rel="noreferrer" className={`mt-2 flex items-center gap-2 rounded-xl border p-3 text-sm font-bold ${mine?'border-white/20 bg-white/10':'bg-muted/50'}`}><FileText className="h-5 w-5 shrink-0"/><span>Document openen</span></a>
}

function escapeRegExp(value:string){return value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
function normalizeText(value:string){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('nl-BE').trim()}

function MentionedText({text,people,userId}:{text:string;people:CrewMember[];userId:string}){
  const entries=people.map(person=>({id:person.id,name:person.full_name?.trim()||''})).filter(entry=>entry.name).sort((a,b)=>b.name.length-a.name.length)
  if(!entries.length)return <>{text}</>
  const mentionMap=new Map(entries.map(entry=>[`@${entry.name.toLocaleLowerCase('nl-BE')}`,entry.id]))
  const pattern=new RegExp(`(@(?:${entries.map(entry=>escapeRegExp(entry.name)).join('|')}))`,'gi')
  return <>{text.split(pattern).map((part,index)=>{
    const mentionedId=mentionMap.get(part.toLocaleLowerCase('nl-BE'))
    if(!mentionedId)return <span key={index}>{part}</span>
    const mine=mentionedId===userId
    return <span key={index} className={mine?"rounded bg-amber-300 px-1 font-black text-black":"rounded bg-violet-500/15 px-0.5 font-bold text-violet-600 dark:text-violet-300"}>{part}</span>
  })}</>
}

function mentionIdsForText(text:string,people:ChatPerson[],userId:string){
  return people.filter(person=>person.id!==userId&&person.full_name?.trim()).filter(person=>{
    const pattern=new RegExp(`(^|\\s)@${escapeRegExp(person.full_name.trim())}(?=$|[\\s.,!?;:])`,'i')
    return pattern.test(text)
  }).map(person=>person.id)
}

function mergeMessages(...sets:Tables<'messages'>[][]){
  const byId=new Map<string,Tables<'messages'>>()
  for(const set of sets)for(const message of set)byId.set(message.id,message)
  return [...byId.values()].sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at))
}

function detectMention(value:string,cursor:number):MentionState|null{
  const before=value.slice(0,cursor)
  const at=before.lastIndexOf('@')
  if(at<0)return null
  if(at>0&&/[A-Za-zÀ-ÿ0-9_]/.test(before[at-1]))return null
  const query=before.slice(at+1)
  if(query.includes('\n')||query.length>80||/[,:;!?()[\]{}]/.test(query))return null
  return {start:at,end:cursor,query}
}

export function ChatClient({channels,defaultChannelId,userId,crewDirectory,isAdmin,profilePhotoUrls,channelImages,privatePeerNames,privatePeerIds,initialChannelStates,focusMessageId}:{channels:Tables<'chat_channels'>[];defaultChannelId:string;userId:string;crewDirectory:CrewMember[];isAdmin:boolean;profilePhotoUrls:Record<string,string>;channelImages:Record<string,string>;privatePeerNames:Record<string,string>;privatePeerIds:Record<string,string>;initialChannelStates:Record<string,ChatSummary>;focusMessageId:string|null}){
  const router=useRouter()
  const [selected,setSelected]=useState(defaultChannelId||channels[0]?.id||'')
  const [cache,setCache]=useState<Record<string,ChannelCache>>({})
  const [body,setBody]=useState('')
  const [file,setFile]=useState<File|null>(null)
  const [fileKey,setFileKey]=useState(0)
  const [status,setStatus]=useState('')
  const [busy,setBusy]=useState(false)
  const [pickerOpen,setPickerOpen]=useState(false)
  const [privatePickerOpen,setPrivatePickerOpen]=useState(false)
  const [privateSearch,setPrivateSearch]=useState('')
  const [uiLocale,setUiLocale]=useState<LiveTranslationLocale>('nl')
  const [translations,setTranslations]=useState<Record<string,string>>({})
  const [translating,setTranslating]=useState<string|null>(null)
  const [autoTranslate,setAutoTranslate]=useState(false)
  const [replyTo,setReplyTo]=useState<Tables<'messages'>|null>(null)
  const [peopleByChannel,setPeopleByChannel]=useState<Record<string,ChatPerson[]>>({})
  const [mentionState,setMentionState]=useState<MentionState|null>(null)
  const [channelStates,setChannelStates]=useState<Record<string,ChatSummary>>(initialChannelStates)
  const [pinsByChannel,setPinsByChannel]=useState<Record<string,ChatPin[]>>({})
  const [typingUsers,setTypingUsers]=useState<string[]>([])
  const [loadingOlder,setLoadingOlder]=useState(false)
  const [searchOpen,setSearchOpen]=useState(false)
  const [searchQuery,setSearchQuery]=useState('')
  const [searchSender,setSearchSender]=useState('')
  const [searchAttachment,setSearchAttachment]=useState('')
  const [searchFrom,setSearchFrom]=useState('')
  const [searchTo,setSearchTo]=useState('')
  const [searchResults,setSearchResults]=useState<ChatSearchResult[]>([])
  const [searchBusy,setSearchBusy]=useState(false)
  const [pinsOpen,setPinsOpen]=useState(false)
  const [profileOpen,setProfileOpen]=useState(false)
  const [highlightedMessageId,setHighlightedMessageId]=useState<string|null>(null)
  const unreadCutoffs=useRef<Record<string,string|null>>(Object.fromEntries(Object.entries(initialChannelStates).map(([id,state])=>[id,state.last_read_at||null])))
  const endRef=useRef<HTMLDivElement>(null)
  const messageListRef=useRef<HTMLDivElement>(null)
  const textareaRef=useRef<HTMLTextAreaElement>(null)
  const typingStopTimerRef=useRef<number|null>(null)
  const typingThrottleRef=useRef(0)
  const draftFilesRef=useRef(new Map<string,File|null>())

  useEffect(()=>{
    const stored=window.localStorage.getItem('uptilldawn-chat-auto-translate')==='1'
    queueMicrotask(()=>setAutoTranslate(stored))
  },[])

  const effectiveSelected=selected&&channels.some(channel=>channel.id===selected)?selected:defaultChannelId||channels[0]?.id||''
  const current=cache[effectiveSelected]||{messages:[],attachments:{},replyTargets:{},hasMore:false}
  const selectedChannel=channels.find(channel=>channel.id===effectiveSelected)
  const currentPeople=peopleByChannel[effectiveSelected]||EMPTY_PEOPLE

  useEffect(()=>{
    const read=()=>{
      const lang=document.documentElement.lang.split('-')[0] as LiveTranslationLocale
      if(['nl','fr','en','de'].includes(lang))setUiLocale(lang)
    }
    read()
    const listener=(event:Event)=>{
      const lang=(event as CustomEvent<string>).detail?.split('-')[0] as LiveTranslationLocale
      if(['nl','fr','en','de'].includes(lang)){setUiLocale(lang);setTranslations({})}
    }
    window.addEventListener('uptilldawn-language-applied',listener)
    return()=>window.removeEventListener('uptilldawn-language-applied',listener)
  },[])

  useEffect(()=>{
    if(!effectiveSelected)return
    const s=createClient()
    let alive=true
    void s.rpc('upt_chat_channel_people',{p_channel:effectiveSelected}).then(({data})=>{
      if(alive)setPeopleByChannel(previous=>({...previous,[effectiveSelected]:(data||[]) as ChatPerson[]}))
    })
    return()=>{alive=false}
  },[effectiveSelected])

  useEffect(()=>{
    if(!effectiveSelected)return
    const s=createClient()
    let alive=true
    async function load(){
      const {data,error}=await s.from('messages').select('*').eq('channel_id',effectiveSelected).order('created_at',{ascending:false}).limit(100)
      if(!alive)return
      if(error){setStatus('Berichten konden niet worden geladen.');return}
      const ordered=((data||[]) as Tables<'messages'>[]).reverse()
      const ids=ordered.map(message=>message.id)
      const idSet=new Set(ids)
      const missingReplyIds=[...new Set(ordered.map(message=>message.reply_to_message_id).filter((id):id is string=>Boolean(id)&&!idSet.has(id!)))]
      const replyTargets:Record<string,Tables<'messages'>>={}
      if(missingReplyIds.length){
        const {data:replyRows}=await s.from('messages').select('*').in('id',missingReplyIds)
        for(const row of (replyRows||[]) as Tables<'messages'>[])replyTargets[row.id]=row
      }
      const grouped:Record<string,Attachment[]>={}
      if(ids.length){
        const {data:rows}=await s.from('message_attachments').select('message_id,storage_path,mime_type').in('message_id',ids)
        const signed=await Promise.all((rows||[]).filter(row=>row.storage_path).map(async row=>{
          const {data:url}=await s.storage.from('chat-attachments').createSignedUrl(row.storage_path!,300)
          return url?.signedUrl?{messageId:row.message_id,url:url.signedUrl,mimeType:row.mime_type}:null
        }))
        for(const item of signed)if(item)(grouped[item.messageId]||=[]).push({url:item.url,mimeType:item.mimeType})
      }
      if(alive)setCache(previous=>({...previous,[effectiveSelected]:{messages:ordered,attachments:grouped,replyTargets}}))
    }
    void load()
    const channel=s.channel(`crew-chat-${effectiveSelected}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'messages',filter:`channel_id=eq.${effectiveSelected}`},()=>void load())
      .subscribe()
    const timer=window.setInterval(()=>void load(),10000)
    return()=>{alive=false;window.clearInterval(timer);void s.removeChannel(channel)}
  },[effectiveSelected])

  useEffect(()=>{endRef.current?.scrollIntoView({block:'end'})},[current.messages.length,effectiveSelected])

  const directory=useMemo(()=>new Map(crewDirectory.map(member=>[member.id,member])),[crewDirectory])
  const messageLookup=useMemo(()=>{
    const map=new Map<string,Tables<'messages'>>()
    for(const message of current.messages)map.set(message.id,message)
    for(const message of Object.values(current.replyTargets))map.set(message.id,message)
    return map
  },[current.messages,current.replyTargets])

  const mentionCandidates=useMemo(()=>{
    if(!mentionState)return []
    const query=normalizeText(mentionState.query)
    return currentPeople.filter(person=>{
      if(!query)return true
      const full=normalizeText(person.full_name||'')
      if(full.startsWith(query))return true
      if(!query.includes(' '))return full.split(/\s+/).some(part=>part.startsWith(query))
      return false
    })
  },[currentPeople,mentionState])

  const privateCandidates=useMemo(()=>{
    const query=normalizeText(privateSearch)
    return crewDirectory.filter(member=>member.id!==userId&&member.full_name?.trim()).filter(member=>{
      if(!query)return true
      const full=normalizeText(member.full_name||'')
      return full.startsWith(query)||full.split(/\s+/).some(part=>part.startsWith(query))
    })
  },[crewDirectory,privateSearch,userId])

  const channelName=(channel:Tables<'chat_channels'>)=>channel.kind==='private'?(channel.name==='Up Till Dawn · persoonlijk'?'Up Till Dawn':privatePeerNames[channel.id]||translateRuntimeUi('Privéchat',uiLocale)):channel.kind==='organization'?'Algemene chat':channel.kind==='workplace'?(channel.name||'Werkplekchat'):(channel.name||'Eventchat')
  const privateChannels=channels.filter(channel=>channel.kind==='private')
  const eventChannels=channels.filter(channel=>channel.kind==='event')
  const workplaceChannels=channels.filter(channel=>channel.kind==='workplace')
  const organizationChannels=channels.filter(channel=>channel.kind==='organization')

  function chooseChannel(id:string){setSelected(id);setPickerOpen(false);setPrivatePickerOpen(false);setStatus('');setReplyTo(null);setMentionState(null)}

  function senderName(message:Tables<'messages'>){
    if(message.sender_id===null)return 'Up Till Dawn'
    if(message.sender_id===userId)return translateRuntimeUi('Jij',uiLocale)
    return directory.get(message.sender_id)?.full_name||translateRuntimeUi('Personeelslid',uiLocale)
  }

  function refreshMentionState(value:string,cursor:number){
    const next=detectMention(value,cursor)
    if(!next){setMentionState(null);return}
    const query=normalizeText(next.query)
    if(!query){setMentionState(next);return}
    const possible=currentPeople.some(person=>{
      const full=normalizeText(person.full_name||'')
      return full.startsWith(query)||(!query.includes(' ')&&full.split(/\s+/).some(part=>part.startsWith(query)))
    })
    setMentionState(possible?next:null)
  }

  function selectMention(person:ChatPerson){
    if(!mentionState)return
    const replacement=`@${person.full_name} `
    const next=body.slice(0,mentionState.start)+replacement+body.slice(mentionState.end)
    const cursor=mentionState.start+replacement.length
    setBody(next)
    setMentionState(null)
    requestAnimationFrame(()=>{
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(cursor,cursor)
    })
  }

  function scrollToMessage(id:string){
    document.querySelector<HTMLElement>(`[data-message-id="${id}"]`)?.scrollIntoView({behavior:'smooth',block:'center'})
  }

  async function translateMessage(messageId:string,text:string){
    if(!text.trim()||translating)return
    setTranslating(messageId)
    setStatus('')
    try{
      const translated=await liveTranslateText(text,uiLocale)
      setTranslations(previous=>({...previous,[messageId]:translated}))
    }catch(error){
      setStatus(error instanceof Error&&error.message==='LIVE_TRANSLATION_UNAVAILABLE'?'Live chatvertaling is niet beschikbaar op dit toestel.':'Bericht kon niet worden vertaald.')
    }finally{setTranslating(null)}
  }

  useEffect(()=>{
    if(!autoTranslate||!current.messages.length)return
    let cancelled=false
    const pending=current.messages.slice(-20).filter(message=>message.sender_id!==null&&message.sender_id!==userId&&!message.moderated_at&&message.body?.trim()&&!translations[message.id])
    if(!pending.length)return
    void (async()=>{
      for(const message of pending){
        if(cancelled)break
        try{
          const translated=await liveTranslateText(message.body||'',uiLocale)
          if(!cancelled)setTranslations(previous=>({...previous,[message.id]:translated}))
        }catch{
          if(!cancelled)setStatus('Automatische chatvertaling kon niet volledig worden uitgevoerd.')
          break
        }
      }
    })()
    return()=>{cancelled=true}
  },[autoTranslate,current.messages,translations,uiLocale,userId])

  async function sendMessage(){
    const trimmed=body.trim()
    if(busy||!effectiveSelected||(!trimmed&&!file))return
    setBusy(true)
    setStatus('')
    try{
      const replyId=replyTo?.id||null
      if(file){
        await enqueueChatPhoto(userId,effectiveSelected,trimmed,file,replyId)
        setBody('')
        setFile(null)
        setFileKey(key=>key+1)
        setStatus(navigator.onLine?'Bestand verzonden.':'Bestand is lokaal bewaard en wordt verzonden zodra je online bent.')
      }else{
        await enqueue(userId,'message',{channel_id:effectiveSelected,body:trimmed,reply_to_message_id:replyId})
        setBody('')
      }
      setReplyTo(null)
      setMentionState(null)
    }catch(error){
      const message=error instanceof Error?error.message:String(error||'')
      setStatus(message.includes('UPLOAD_LOCAL_FILE_EMPTY')
        ?'Het lokaal bewaarde bestand bevat geen leesbare gegevens meer. Verwijder deze wachtrij-upload en selecteer het originele bestand opnieuw.'
        :message.startsWith('UPLOAD_SYNC_FAILED:')
          ?`Bestand kon niet naar de server worden verzonden: ${message.slice('UPLOAD_SYNC_FAILED:'.length)}`
          :message==='UPLOAD_SESSION_MISMATCH'
            ?'Je sessie is gewijzigd. Meld opnieuw aan voordat je het bestand opnieuw verzendt.'
            :message||'Bericht kon niet worden bewaard.')
      console.error('[chat-upload]',error)
    }finally{setBusy(false)}
  }

  async function startPrivateChat(peerId:string){
    if(busy)return
    setBusy(true)
    setStatus('')
    try{
      const s=createClient()
      const {data,error}=await s.rpc('upt_create_private_chat',{p_user:peerId})
      if(error)throw error
      if(!data)throw new Error('Privéchat kon niet worden gestart.')
      setPrivatePickerOpen(false)
      setPrivateSearch('')
      router.push(`/chat?channel=${data}`)
      router.refresh()
    }catch{
      setStatus('Privéchat kon niet worden gestart.')
    }finally{setBusy(false)}
  }

  async function deletePrivateChat(){
    if(busy||!selectedChannel||selectedChannel.kind!=='private'||selectedChannel.name==='Up Till Dawn · persoonlijk')return
    const confirmed=window.confirm(translateRuntimeUi('Deze privéchat verwijderen? Het volledige gesprek wordt voor beide deelnemers verwijderd. Berichten kunnen niet afzonderlijk worden verwijderd.',uiLocale))
    if(!confirmed)return
    setBusy(true)
    setStatus('')
    try{
      const s=createClient()
      const {error}=await s.rpc('upt_delete_private_chat',{p_channel:selectedChannel.id})
      if(error)throw error
      router.push('/chat')
      router.refresh()
    }catch{
      setStatus('Privéchat kon niet worden verwijderd.')
    }finally{setBusy(false)}
  }

  async function moderate(messageId:string){
    const reason=window.prompt('Reden voor moderatie (wordt geaudit):')?.trim()
    if(!reason||busy)return
    setBusy(true)
    try{
      const s=createClient()
      const {error}=await s.rpc('upt_moderate_message',{p_message:messageId,p_reason:reason})
      if(error)throw error
      setStatus('Bericht gemodereerd.')
    }catch{setStatus('Moderatie mislukt.')}
    finally{setBusy(false)}
  }

  if(!selectedChannel)return <section className="rounded-2xl border p-6"><h1 className="text-2xl font-black">Chat</h1><p className="mt-2 text-muted-foreground">Er zijn momenteel geen beschikbare chats.</p></section>

  return <section className="relative flex min-h-[calc(100dvh-9rem)] flex-col overflow-hidden bg-background md:min-h-[70vh] md:rounded-3xl md:border">
    <header className="sticky top-0 z-30 border-b bg-background/95 px-3 py-3 backdrop-blur md:px-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={()=>setPickerOpen(open=>!open)} className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-1 text-left hover:bg-muted/60">
          <ChannelAvatar src={channelImages[selectedChannel.id]}/>
          <div className="min-w-0 flex-1"><p className="truncate text-base font-black">{channelName(selectedChannel)}</p><p className="text-xs text-muted-foreground">Tik om van chat te wisselen</p></div>
          <ChevronDown className={`h-5 w-5 shrink-0 ${pickerOpen?'rotate-180':''}`}/>
        </button>
        <label className="flex shrink-0 items-center gap-2 rounded-xl border px-2 py-2 text-[11px] font-semibold text-muted-foreground">
          <input type="checkbox" checked={autoTranslate} onChange={event=>{const enabled=event.target.checked;setAutoTranslate(enabled);window.localStorage.setItem('uptilldawn-chat-auto-translate',enabled?'1':'0')}}/>
          <span className="hidden sm:inline">Chat automatisch vertalen</span><span className="sm:hidden" aria-label="Chat automatisch vertalen">Auto</span>
        </label>
        <button type="button" onClick={()=>{setPrivatePickerOpen(open=>!open);setPickerOpen(false)}} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-card" aria-label={translateRuntimeUi('Nieuwe privéchat',uiLocale)} title={translateRuntimeUi('Nieuwe privéchat',uiLocale)}><MessageCirclePlus className="h-5 w-5"/></button>
        {selectedChannel.kind==='private'&&selectedChannel.name!=='Up Till Dawn · persoonlijk'&&<button type="button" disabled={busy} onClick={()=>void deletePrivateChat()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-card" aria-label={translateRuntimeUi('Privéchat verwijderen',uiLocale)} title={translateRuntimeUi('Privéchat verwijderen',uiLocale)}><Trash2 className="h-5 w-5"/></button>}
      </div>
      {pickerOpen&&<div className="absolute left-3 right-3 top-[4.5rem] z-40 max-h-[65vh] overflow-y-auto rounded-2xl border bg-card p-2 shadow-2xl">
        <div className="flex items-center justify-between px-2 py-1"><p className="text-sm font-black">Gesprekken</p><button type="button" onClick={()=>setPickerOpen(false)} className="rounded-full p-2"><X className="h-4 w-4"/></button></div>
        {[[privateChannels,'Privégesprekken'],[organizationChannels,'Algemeen'],[eventChannels,'Evenementen'],[workplaceChannels,'Werkplekken']]
          .filter(([group])=>(group as Tables<'chat_channels'>[]).length>0)
          .map(([group,label])=><div key={label as string} className="mt-2">
            <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-[.16em] text-muted-foreground">{label as string}</p>
            {(group as Tables<'chat_channels'>[]).map(channel=><ChannelButton key={channel.id} channel={channel} selected={effectiveSelected} onChoose={chooseChannel} name={channelName(channel)} image={channelImages[channel.id]}/>)}
          </div>)}
      </div>}
      {privatePickerOpen&&<div className="absolute left-3 right-3 top-[4.5rem] z-50 rounded-2xl border bg-card p-3 shadow-2xl">
        <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-black">Nieuwe privéchat</p><p className="text-xs text-muted-foreground">Kies iemand om een privéchat te starten.</p></div><button type="button" onClick={()=>setPrivatePickerOpen(false)} className="rounded-full p-2"><X className="h-4 w-4"/></button></div>
        <input value={privateSearch} onChange={event=>setPrivateSearch(event.target.value)} placeholder="Zoek persoon…" className="mt-3 w-full rounded-xl border bg-background px-3 py-2 text-sm"/>
        <div className="mt-2 max-h-64 overflow-y-auto">
          {privateCandidates.length?privateCandidates.map(member=><button key={member.id} type="button" disabled={busy} onClick={()=>void startPrivateChat(member.id)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-muted disabled:opacity-50">
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border bg-muted">{profilePhotoUrls[member.id]?<img src={profilePhotoUrls[member.id]} alt="" className="h-full w-full object-cover"/>:<div className="flex h-full w-full items-center justify-center text-[10px] font-black">{(member.full_name||'').split(/\s+/).map(part=>part[0]).join('').slice(0,2).toUpperCase()}</div>}</div>
            <span className="min-w-0 flex-1 truncate text-sm font-bold">{member.full_name}</span>
          </button>):<p className="px-3 py-4 text-sm text-muted-foreground">Geen personen gevonden.</p>}
        </div>
      </div>}
    </header>

    <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4 md:px-5">
      {!current.messages.length&&<p className="py-10 text-center text-sm text-muted-foreground">Nog geen berichten in deze chat.</p>}
      {current.messages.map(message=>{
        const isSystem=message.sender_id===null
        const sender=message.sender_id?directory.get(message.sender_id):undefined
        const mine=!isSystem&&message.sender_id===userId
        const moderated=Boolean(message.moderated_at)
        const displaySender=isSystem?'Up Till Dawn':mine?translateRuntimeUi('Jij',uiLocale):sender?.full_name||translateRuntimeUi('Personeelslid',uiLocale)
        const initials=(mine?(directory.get(userId)?.full_name||translateRuntimeUi('Jij',uiLocale)):displaySender).split(/\s+/).map(part=>part[0]).join('').slice(0,2).toUpperCase()
        const photoUrl=isSystem?'/up-till-dawn-mark.webp':message.sender_id?profilePhotoUrls[message.sender_id]:undefined
        const timestampLocale=uiLocale==='fr'?'fr-BE':uiLocale==='en'?'en-GB':uiLocale==='de'?'de-DE':'nl-BE'
        const timestamp=selectedChannel.kind==='organization'?new Date(message.created_at).toLocaleString(timestampLocale):new Date(message.created_at).toLocaleTimeString(timestampLocale,{hour:'2-digit',minute:'2-digit'})
        const translated=translations[message.id]
        const displayBody=isSystem?translateSystemMessage(message.body||'',message.content,uiLocale):translated||message.body||''
        const replyTarget=message.reply_to_message_id?messageLookup.get(message.reply_to_message_id):undefined
        const replyText=replyTarget?.moderated_at
          ?translateRuntimeUi('Bericht verwijderd door beheerder',uiLocale)
          :replyTarget?.sender_id===null
            ?translateSystemMessage(replyTarget.body||'',replyTarget.content,uiLocale)
            :replyTarget?.body||''
        return <article data-message-id={message.id} key={message.id} className={`flex items-end gap-2 ${mine?'justify-end':'justify-start'}`}>
          {!mine&&<div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border bg-muted">{photoUrl?<img src={photoUrl} alt="" className="h-full w-full object-cover"/>:<div className="flex h-full w-full items-center justify-center text-[10px] font-black">{initials}</div>}</div>}
          <div className={`max-w-[82%] ${mine?'items-end':'items-start'} flex flex-col`}>
            {!mine&&<p className="mb-1 px-1 text-xs font-bold text-muted-foreground">{displaySender}</p>}
            <div className={`rounded-2xl px-3.5 py-2.5 shadow-sm ${mine?'rounded-br-md bg-violet-600 text-white':'rounded-bl-md border bg-card'}`}>
              {replyTarget&&<button type="button" onClick={()=>scrollToMessage(replyTarget.id)} className={`mb-2 block w-full rounded-xl border-l-4 px-3 py-2 text-left text-xs ${mine?'border-white/70 bg-white/10':'border-violet-500 bg-muted/60'}`}>
                <span className="block font-bold">{translateRuntimeUi('Antwoord op',uiLocale)} {senderName(replyTarget)}</span>
                <span className="mt-0.5 block max-w-full truncate opacity-80">{replyText.slice(0,160)}</span>
              </button>}
              {moderated
                ?<p className="whitespace-pre-wrap break-words text-sm leading-relaxed">Bericht verwijderd door beheerder</p>
                :<p data-no-translate className="whitespace-pre-wrap break-words text-sm leading-relaxed"><MentionedText text={displayBody} people={crewDirectory}/></p>}
              {!moderated&&current.attachments[message.id]?.map((attachment,index)=><AttachmentView key={index} attachment={attachment} mine={mine}/>)}
              <div className={`mt-1.5 flex flex-wrap items-center justify-end gap-2 text-[10px] ${mine?'text-white/75':'text-muted-foreground'}`}>
                <time>{timestamp}</time>
                {!moderated&&!isSystem&&message.body&&<button type="button" disabled={translating===message.id} onClick={()=>translated?setTranslations(previous=>{const next={...previous};delete next[message.id];return next}):void translateMessage(message.id,message.body||'')} className="underline">{translated?'Origineel':translating===message.id?'Vertalen…':'Vertaal'}</button>}
                {!moderated&&selectedChannel.name!=='Up Till Dawn · persoonlijk'&&<button type="button" onClick={()=>{setReplyTo(message);requestAnimationFrame(()=>textareaRef.current?.focus())}} className="font-semibold underline">{translateRuntimeUi('Antwoorden',uiLocale)}</button>}
                {isAdmin&&!moderated&&<button type="button" disabled={busy} onClick={()=>moderate(message.id)} className="underline">Modereer</button>}
              </div>
            </div>
          </div>
        </article>
      })}
      <div ref={endRef}/>
    </div>

    {selectedChannel.name!=='Up Till Dawn · persoonlijk'&&<div className="relative sticky bottom-0 z-20 border-t bg-background/95 p-3 backdrop-blur">
      {mentionState&&<div className="absolute bottom-full left-3 right-3 z-30 mb-2 max-h-56 overflow-y-auto rounded-2xl border bg-card p-1 shadow-2xl">
        {mentionCandidates.length
          ?mentionCandidates.map(person=><button key={person.id} type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>selectMention(person)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-muted">
            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border bg-muted">{profilePhotoUrls[person.id]?<img src={profilePhotoUrls[person.id]} alt="" className="h-full w-full object-cover"/>:<div className="flex h-full w-full items-center justify-center text-[10px] font-black">{person.full_name.split(/\s+/).map(part=>part[0]).join('').slice(0,2).toUpperCase()}</div>}</div>
            <span className="min-w-0 flex-1 truncate text-sm font-bold">{person.full_name}</span>
          </button>)
          :<p className="px-3 py-3 text-sm text-muted-foreground">{translateRuntimeUi('Geen personen gevonden.',uiLocale)}</p>}
      </div>}

      {replyTo&&<div className="mb-2 flex items-start gap-3 rounded-xl border bg-card px-3 py-2 text-xs">
        <div className="min-w-0 flex-1">
          <p className="font-bold">{translateRuntimeUi('Antwoord op',uiLocale)} {senderName(replyTo)}</p>
          <p className="mt-0.5 truncate text-muted-foreground">{replyTo.moderated_at?translateRuntimeUi('Bericht verwijderd door beheerder',uiLocale):(replyTo.body||'')}</p>
        </div>
        <button type="button" onClick={()=>setReplyTo(null)} className="rounded-full p-1" aria-label={translateRuntimeUi('Antwoord verwijderen',uiLocale)}><X className="h-4 w-4"/></button>
      </div>}

      {file&&<div className="mb-2 flex items-center justify-between rounded-xl border bg-card px-3 py-2 text-xs"><span className="truncate">{file.name}</span><button type="button" onClick={()=>{setFile(null);setFileKey(key=>key+1)}}><X className="h-4 w-4"/></button></div>}
      <form className="flex items-end gap-2" onSubmit={event=>{event.preventDefault();void sendMessage()}}>
        <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border bg-card" aria-label="Bestand toevoegen"><Paperclip className="h-5 w-5"/><input key={fileKey} type="file" accept={ACCEPT} onChange={event=>setFile(event.target.files?.[0]||null)} className="sr-only"/></label>
        <textarea
          ref={textareaRef}
          maxLength={4000}
          rows={2}
          value={body}
          onChange={event=>{const value=event.target.value;setBody(value);refreshMentionState(value,event.target.selectionStart)}}
          onSelect={event=>refreshMentionState(body,event.currentTarget.selectionStart)}
          placeholder="Typ een bericht…"
          className="max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-2xl border bg-card px-4 py-3 text-sm"
        />
        <button data-action="chat-send" type="submit" disabled={busy||(!body.trim()&&!file)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white disabled:opacity-40"><Send className="h-5 w-5"/></button>
      </form>
      <p className="mt-1 text-center text-[10px] text-muted-foreground">Enter = nieuwe regel · verzenden gebeurt met de knop.</p>
      {status&&<p className="mt-2 text-center text-xs text-muted-foreground">{status}</p>}
    </div>}
  </section>
}

function ChannelButton({channel,selected,onChoose,name,image}:{channel:Tables<'chat_channels'>;selected:string;onChoose:(id:string)=>void;name:string;image?:string}){
  return <button type="button" onClick={()=>onChoose(channel.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left ${channel.id===selected?'bg-violet-600 text-white':'hover:bg-muted'}`}><ChannelAvatar src={image} size="sm"/><span className="min-w-0 flex-1 truncate text-sm font-bold">{name}</span></button>
}
