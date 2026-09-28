'use client'

import { useMemo, useRef, useState } from 'react'
import targets from '@/lib/god-source-index.json'
import type { SourceTarget } from '@/lib/god-studio'

type Role = 'staff' | 'responsible_lead' | 'admin'
type Device = 'desktop' | 'tablet' | 'mobile'

type Selected = {
  text: string
  tag: string
  aria: string
  selector: string
}

const roleLabels: Record<Role,string> = {
  staff: 'Personeel',
  responsible_lead: 'Verantwoordelijke',
  admin: 'Admin',
}

const roleHome: Record<Role,string> = {
  staff: '/',
  responsible_lead: '/',
  admin: '/admin',
}

const pageOptions: Record<Role,{label:string;path:string}[]> = {
  staff: [
    {label:'Overzicht',path:'/'},
    {label:'Evenementen',path:'/events'},
    {label:'Mijn werkuren',path:'/operations'},
    {label:'Shifts',path:'/shifts'},
    {label:'Briefing',path:'/briefings'},
    {label:'Werkplekken',path:'/workplaces'},
    {label:'Taken',path:'/tasks'},
    {label:'Chats',path:'/chat'},
    {label:'Profiel',path:'/settings'},
  ],
  responsible_lead: [
    {label:'Overzicht',path:'/'},
    {label:'Evenementen',path:'/events'},
    {label:'Mijn werkuren',path:'/operations'},
    {label:'Shifts',path:'/shifts'},
    {label:'Briefing',path:'/briefings'},
    {label:'Werkplekken',path:'/workplaces'},
    {label:'Taken',path:'/tasks'},
    {label:'Help',path:'/incidents'},
    {label:'Profiel',path:'/settings'},
  ],
  admin: [
    {label:'Overzicht',path:'/admin'},
    {label:'Evenementen',path:'/events'},
    {label:'Werkuren',path:'/operations'},
    {label:'Shifts',path:'/shifts'},
    {label:'Werkplekken',path:'/workplaces'},
    {label:'Taken',path:'/tasks'},
    {label:'Briefing',path:'/briefings'},
    {label:'Personeel',path:'/personnel'},
    {label:'Chats',path:'/chat'},
    {label:'Excel',path:'/exports'},
    {label:'Instellingen',path:'/settings'},
  ],
}

function widthFor(device:Device){
  if(device==='mobile') return 390
  if(device==='tablet') return 820
  return 1440
}

function selectorFor(element: HTMLElement) {
  if (element.id) return `#${CSS.escape(element.id)}`
  const testId = element.getAttribute('data-testid')
  if (testId) return `[data-testid="${CSS.escape(testId)}"]`
  const aria = element.getAttribute('aria-label')
  if (aria) return `${element.tagName.toLowerCase()}[aria-label="${CSS.escape(aria)}"]`
  const classes = [...element.classList].slice(0,3).map(name=>'.'+CSS.escape(name)).join('')
  return element.tagName.toLowerCase()+classes
}

export function GodVisualBuilder({
  onOpenSource,
  onPrepareAi,
}:{
  onOpenSource:(file:string,line:number)=>void
  onPrepareAi:(prompt:string,file?:string,line?:number)=>void
}) {
  const [role,setRole] = useState<Role>('admin')
  const [path,setPath] = useState('/admin')
  const [device,setDevice] = useState<Device>('desktop')
  const [selected,setSelected] = useState<Selected|null>(null)
  const [text,setText] = useState('')
  const [fontSize,setFontSize] = useState('')
  const [width,setWidth] = useState('')
  const [height,setHeight] = useState('')
  const [radius,setRadius] = useState('')
  const [padding,setPadding] = useState('')
  const [margin,setMargin] = useState('')
  const [x,setX] = useState('')
  const [y,setY] = useState('')
  const [foreground,setForeground] = useState('')
  const [background,setBackground] = useState('')
  const [visible,setVisible] = useState(true)
  const [buttonLabel,setButtonLabel] = useState('Nieuwe knop')
  const [buttonAction,setButtonAction] = useState('/events')
  const [status,setStatus] = useState('')
  const [frameKey,setFrameKey] = useState(0)
  const frameRef=useRef<HTMLIFrameElement>(null)

  const matches = useMemo(()=>{
    if(!selected)return []
    const needle=(selected.aria||selected.text).toLowerCase()
    return (targets as SourceTarget[]).filter(target=>
      needle && `${target.label} ${target.handler}`.toLowerCase().includes(needle)
    ).slice(0,8)
  },[selected])

  async function switchRole(next:Role){
    setStatus('')
    const response=await fetch('/api/god/preview-role',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({role:next}),
    })
    const data=await response.json()
    if(!response.ok){setStatus(data.error||'Rolvoorbeeld kon niet worden geopend.');return}
    setRole(next)
    setPath(roleHome[next])
    setSelected(null)
    setFrameKey(value=>value+1)
  }

  function inspect(frame:HTMLIFrameElement){
    try{
      const doc=frame.contentDocument
      if(!doc)return
      const style=doc.createElement('style')
      style.dataset.godModeInspector='true'
      style.textContent='[data-god-selected="true"]{outline:2px solid #a855f7!important;outline-offset:2px!important;cursor:crosshair!important}'
      doc.head.appendChild(style)
      doc.addEventListener('click',event=>{
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
        const target=(event.target as HTMLElement|null)?.closest('button,a,input,select,textarea,label,h1,h2,h3,p,section,article,div,nav,aside') as HTMLElement|null
        if(!target)return
        doc.querySelectorAll('[data-god-selected="true"]').forEach(el=>el.removeAttribute('data-god-selected'))
        target.setAttribute('data-god-selected','true')
        const next={
          text:(target.textContent||'').trim().replace(/\s+/g,' ').slice(0,160),
          tag:target.tagName.toLowerCase(),
          aria:target.getAttribute('aria-label')||'',
          selector:selectorFor(target),
        }
        setSelected(next)
        setText((target.textContent||'').trim())
        setFontSize(target.style.fontSize)
        setWidth(target.style.width)
        setHeight(target.style.height)
        setRadius(target.style.borderRadius)
        setPadding(target.style.padding)
        setMargin(target.style.margin)
        setX(target.style.left)
        setY(target.style.top)
        setForeground(target.style.color)
        setBackground(target.style.backgroundColor)
        setVisible(target.style.display!=='none')
      },true)
      doc.addEventListener('submit',event=>event.preventDefault(),true)
    }catch{
      setStatus('Preview kon niet worden geïnspecteerd.')
    }
  }

  function selectedElement(){
    const doc=frameRef.current?.contentDocument
    if(!doc||!selected)return null
    return doc.querySelector('[data-god-selected="true"]') as HTMLElement|null
  }

  function applyPreview(){
    const element=selectedElement()
    if(!element){setStatus('Selecteer eerst een onderdeel in de preview.');return}
    if(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement){
      element.value=text
      element.setAttribute('value',text)
    }else if(text!==selected?.text){
      element.textContent=text
    }
    element.style.fontSize=fontSize
    element.style.width=width
    element.style.height=height
    element.style.borderRadius=radius
    element.style.padding=padding
    element.style.margin=margin
    element.style.color=foreground
    element.style.backgroundColor=background
    element.style.display=visible?'':'none'
    if(x||y){
      element.style.position='relative'
      element.style.left=x
      element.style.top=y
    }else{
      element.style.left=''
      element.style.top=''
    }
    setStatus('Preview aangepast. Maak daarna een AI-codevoorstel om dit duurzaam op te slaan.')
  }

  function describeChange(){
    if(!selected)return ''
    return [
      `Pas in God Mode het geselecteerde element aan op pagina ${path} voor rol ${roleLabels[role]}.`,
      `Element: ${selected.tag}, selector-indicatie: ${selected.selector}, huidige tekst: "${selected.text}".`,
      text!==selected.text?`Nieuwe tekst: "${text}".`:'',
      fontSize?`Font-size: ${fontSize}.`:'',
      width?`Breedte: ${width}.`:'',
      height?`Hoogte: ${height}.`:'',
      radius?`Border-radius: ${radius}.`:'',
      padding?`Padding: ${padding}.`:'',
      margin?`Margin: ${margin}.`:'',
      x||y?`Positie-offset: left ${x||'0'}, top ${y||'0'}.`:'',
      foreground?`Tekstkleur: ${foreground}.`:'',
      background?`Achtergrondkleur: ${background}.`:'',
      !visible?'Maak het element onzichtbaar.':'',
      'Behoud bestaande authenticatie, autorisatie en overige logica. Gebruik responsieve Tailwind/CSS waar mogelijk.',
    ].filter(Boolean).join(' ')
  }

  function createPreviewButton(){
    const doc=frameRef.current?.contentDocument
    if(!doc)return
    const host=doc.querySelector('main')||doc.body
    const button=doc.createElement('button')
    button.type='button'
    button.textContent=buttonLabel
    button.setAttribute('data-god-preview-new','true')
    button.style.padding='12px 16px'
    button.style.border='1px solid currentColor'
    button.style.borderRadius='12px'
    button.style.margin='12px'
    button.onclick=event=>{event.preventDefault();event.stopPropagation()}
    host.appendChild(button)
    setStatus('Knop aan preview toegevoegd. Gebruik "Codevoorstel voor nieuwe knop" om hem echt te implementeren.')
  }

  return <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
    <section className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border p-3">
        {(Object.keys(roleLabels) as Role[]).map(item=><button key={item} onClick={()=>void switchRole(item)} className={`rounded-xl px-4 py-2 text-sm font-black ${role===item?'bg-violet-600 text-white':'border'}`}>{roleLabels[item]}</button>)}
        <select value={path} onChange={e=>{setPath(e.target.value);setSelected(null);setFrameKey(value=>value+1)}} className="min-w-44 rounded-xl border bg-background px-3 py-2">
          {pageOptions[role].map(page=><option key={page.path} value={page.path}>{page.label}</option>)}
        </select>
        <div className="ml-auto flex gap-1">
          {(['desktop','tablet','mobile'] as Device[]).map(item=><button key={item} onClick={()=>setDevice(item)} className={`rounded-lg px-3 py-2 text-xs ${device===item?'bg-muted font-bold':'border'}`}>{item}</button>)}
        </div>
      </div>

      <div className="overflow-auto rounded-2xl border bg-zinc-950 p-3">
        <div className="mx-auto overflow-hidden rounded-xl bg-white shadow-2xl" style={{width:`min(100%, ${widthFor(device)}px)`}}>
          <iframe ref={frameRef} key={`${role}:${path}:${frameKey}`} title={`${roleLabels[role]} preview`} src={path} onLoad={e=>inspect(e.currentTarget)} className="h-[72vh] w-full bg-white"/>
        </div>
      </div>
      {status&&<p role="status" className="rounded-xl border border-violet-500/40 p-3 text-sm">{status}</p>}
    </section>

    <aside className="space-y-4">
      <section className="space-y-3 rounded-2xl border p-4">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-violet-400">Inspector</p>
          <h2 className="font-black">{selected?selected.text||selected.tag:'Klik een element in de preview'}</h2>
          {selected&&<p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{selected.selector}</p>}
        </div>
        <label className="block text-xs">Tekst<textarea value={text} onChange={e=>setText(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border bg-background p-2 text-sm"/></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs">Breedte<input value={width} onChange={e=>setWidth(e.target.value)} placeholder="100% / 320px" className="mt-1 w-full rounded-lg border bg-background p-2"/></label>
          <label className="text-xs">Hoogte<input value={height} onChange={e=>setHeight(e.target.value)} placeholder="auto / 48px" className="mt-1 w-full rounded-lg border bg-background p-2"/></label>
          <label className="text-xs">Font<input value={fontSize} onChange={e=>setFontSize(e.target.value)} placeholder="16px" className="mt-1 w-full rounded-lg border bg-background p-2"/></label>
          <label className="text-xs">Ronding<input value={radius} onChange={e=>setRadius(e.target.value)} placeholder="12px" className="mt-1 w-full rounded-lg border bg-background p-2"/></label>
          <label className="text-xs">Padding<input value={padding} onChange={e=>setPadding(e.target.value)} placeholder="12px" className="mt-1 w-full rounded-lg border bg-background p-2"/></label>
          <label className="text-xs">Margin<input value={margin} onChange={e=>setMargin(e.target.value)} placeholder="0" className="mt-1 w-full rounded-lg border bg-background p-2"/></label>
          <label className="text-xs">X<input value={x} onChange={e=>setX(e.target.value)} placeholder="0px" className="mt-1 w-full rounded-lg border bg-background p-2"/></label>
          <label className="text-xs">Y<input value={y} onChange={e=>setY(e.target.value)} placeholder="0px" className="mt-1 w-full rounded-lg border bg-background p-2"/></label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs">Tekstkleur<input type="color" value={foreground||'#ffffff'} onChange={e=>setForeground(e.target.value)} className="mt-1 h-10 w-full rounded border bg-background"/></label>
          <label className="text-xs">Achtergrond<input type="color" value={background||'#000000'} onChange={e=>setBackground(e.target.value)} className="mt-1 h-10 w-full rounded border bg-background"/></label>
        </div>
        <label className="flex items-center justify-between rounded-lg border p-2 text-sm">Zichtbaar<input type="checkbox" checked={visible} onChange={e=>setVisible(e.target.checked)}/></label>
        <button disabled={!selected} onClick={applyPreview} className="w-full rounded-xl bg-violet-600 px-4 py-3 font-black text-white disabled:opacity-40">Preview toepassen</button>
        <button disabled={!selected} onClick={()=>{
          const match=matches[0]
          onPrepareAi(describeChange(),match?.file,match?.line)
        }} className="w-full rounded-xl border px-4 py-3 font-bold disabled:opacity-40">AI-codevoorstel maken</button>
        {matches.length>0&&<div className="space-y-1 border-t pt-3"><p className="text-xs font-bold">Waarschijnlijke bron</p>{matches.map(match=><button key={`${match.file}:${match.line}`} onClick={()=>onOpenSource(match.file,match.line)} className="block w-full rounded-lg border p-2 text-left text-xs"><span className="font-mono">{match.file}:{match.line}</span><br/>{match.label||match.handler}</button>)}</div>}
      </section>

      <section className="space-y-3 rounded-2xl border p-4">
        <p className="text-xs font-black uppercase tracking-wider text-violet-400">Functie / knop toevoegen</p>
        <input value={buttonLabel} onChange={e=>setButtonLabel(e.target.value)} placeholder="Knoptekst" className="w-full rounded-lg border bg-background p-2"/>
        <input value={buttonAction} onChange={e=>setButtonAction(e.target.value)} placeholder="/events of actieomschrijving" className="w-full rounded-lg border bg-background p-2"/>
        <button onClick={createPreviewButton} className="w-full rounded-xl border px-4 py-2">Voorbeeldknop toevoegen</button>
        <button onClick={()=>onPrepareAi(`Voeg op pagina ${path} voor rol ${roleLabels[role]} een nieuwe knop toe met tekst "${buttonLabel}". De knop moet deze actie uitvoeren: ${buttonAction}. Plaats hem logisch in de bestaande layout, responsief, met dezelfde visuele stijl en behoud alle bestaande autorisatie.`)} className="w-full rounded-xl bg-violet-600 px-4 py-2 font-bold text-white">Codevoorstel voor nieuwe knop</button>
      </section>

      <section className="space-y-3 rounded-2xl border p-4">
        <p className="text-xs font-black uppercase tracking-wider text-violet-400">Thema</p>
        <p className="text-sm text-muted-foreground">Gebruik AI om globale kleuren, typografie, radius, spacing of componentstijl veilig in de broncode door te voeren.</p>
        <button onClick={()=>onPrepareAi('Open de relevante globale CSS/theme-bestanden en maak de visuele stijl van de app volledig instelbaar vanuit God Mode. Behoud dark mode en responsiviteit. Voeg duidelijke CSS custom properties toe voor achtergrond, voorgrond, accentkleur, borders, radius en spacing.')} className="w-full rounded-xl border px-4 py-2">Thema-editor voorbereiden</button>
      </section>
    </aside>
  </div>
}
