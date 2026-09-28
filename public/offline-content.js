(()=>{
 function req(r){return new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
 function txDone(tx){return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}
 function shellDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open('uptilldawn-offline-shell',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
 function contentDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open('uptilldawn-offline-content',2);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('content'))r.result.createObjectStore('content',{keyPath:'userId'});if(!r.result.objectStoreNames.contains('documents'))r.result.createObjectStore('documents',{keyPath:'key'})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
 function queueDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open('uptilldawn-operations',2);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains('operations'))db.createObjectStore('operations',{keyPath:'id'});if(!db.objectStoreNames.contains('uploads'))db.createObjectStore('uploads',{keyPath:'id'})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
 function escape(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
 function section(title,html){const el=document.createElement('section');el.className='card';el.innerHTML='<h2>'+escape(title)+'</h2>'+html;return el}
 function btn(label,onClick,disabled=false){const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=disabled;b.onclick=onClick;return b}
 function euro(cents){return new Intl.NumberFormat('nl-BE',{style:'currency',currency:'EUR'}).format(Number(cents||0)/100)}
 async function enqueue(userId,type,payload){
  const db=await queueDb()
  try{
   const tx=db.transaction('operations','readwrite')
   tx.objectStore('operations').put({id:crypto.randomUUID(),userId,type,payload,createdAt:Date.now(),attempts:0})
   await txDone(tx)
  }finally{db.close()}
  window.dispatchEvent(new Event('crew-queue-change'))
  const status=document.getElementById('offlineActionStatus')
  if(status)status.textContent='Actie lokaal bewaard. Synchronisatie gebeurt zodra de verbinding terug is.'
 }
 async function run(){
  let userId=''
  const shell=await shellDb()
  try{const meta=await req(shell.transaction('meta').objectStore('meta').get('activeUserId'));userId=meta?.value||''}finally{shell.close()}
  if(!userId)return
  const db=await contentDb()
  let data,documents=[]
  try{
   data=await req(db.transaction('content').objectStore('content').get(userId))
   documents=(await req(db.transaction('documents').objectStore('documents').getAll())||[]).filter(item=>item.userId===userId)
  }finally{db.close()}
  if(!data&&!documents.length)return

  const main=document.querySelector('main')
  if(!main)return
  const queue=document.getElementById('queue')
  const eventName=id=>(data.events||[]).find(e=>e.id===id)?.name||'Evenement'
  const workplaceName=id=>(data.workplaces||[]).find(w=>w.id===id)?.name||'Werkplek'

  const stamp=document.createElement('section')
  stamp.className='card'
  stamp.innerHTML='<h2>Offline operationele acties</h2><small>Laatst online bijgewerkt: '+new Date(data.savedAt).toLocaleString('nl-BE')+'</small><p id="offlineActionStatus" class="ok"></p>'
  if(queue)main.insertBefore(stamp,queue);else main.append(stamp)

  const eventHtml=(data.events||[]).length?(data.events||[]).map(item=>'<article class="row" style="display:block"><strong>'+escape(item.name)+'</strong>'+(item.address?'<p>'+escape(item.address)+'</p>':'')+'<small>'+new Date(item.start_at).toLocaleString('nl-BE')+' → '+new Date(item.end_at).toLocaleString('nl-BE')+' · '+escape(item.status)+'</small></article>').join(''):'<p class="empty">Geen opgeslagen evenementen.</p>'
  const workplaceHtml=(data.workplaces||[]).length?(data.workplaces||[]).map(item=>'<article class="row" style="display:block"><strong>'+escape(item.name)+'</strong>'+(item.description?'<p>'+escape(item.description)+'</p>':'')+'</article>').join(''):'<p class="empty">Geen opgeslagen werkplekken.</p>'
  const shiftHtml=(data.shifts||[]).length?(data.shifts||[]).map(item=>'<article class="row" style="display:block"><strong>'+escape(item.role_name)+'</strong><small>'+new Date(item.scheduled_start).toLocaleString('nl-BE')+' → '+new Date(item.scheduled_end).toLocaleString('nl-BE')+' · '+escape(item.response_status||item.status)+'</small></article>').join(''):'<p class="empty">Geen opgeslagen shifts.</p>'
  const emergencyHtml=(data.emergency||[]).length?(data.emergency||[]).map(item=>'<article class="row" style="display:block"><strong>'+escape(item.event_name)+' · '+escape(item.emergency_number)+'</strong>'+(item.event_address?'<p>'+escape(item.event_address)+'</p>':'')+(item.first_aid_contact?'<small>EHBO: '+escape(item.first_aid_contact)+'</small>':'')+(item.security_contact?'<small>Security: '+escape(item.security_contact)+'</small>':'')+(item.assembly_point?'<p><strong>Verzamelpunt:</strong> '+escape(item.assembly_point)+'</p>':'')+(item.procedure?'<p style="white-space:pre-wrap">'+escape(item.procedure)+'</p>':'')+'</article>').join(''):'<p class="empty">Geen opgeslagen noodinformatie.</p>'
  const briefingHtml=(data.briefings||[]).length?(data.briefings||[]).map(item=>'<article class="row" style="display:block"><strong>'+(item.kind==='personal'?'Persoonlijk · ':'')+escape(item.title)+' · v'+escape(item.version)+'</strong><p style="white-space:pre-wrap">'+escape(item.body)+'</p></article>').join(''):'<p class="empty">Geen opgeslagen instructies.</p>'
  const taskHtml=(data.tasks||[]).length?(data.tasks||[]).map(item=>'<article class="row" style="display:block"><strong>'+escape(item.title)+'</strong><small>'+escape(item.status)+'</small>'+(item.description?'<p style="white-space:pre-wrap">'+escape(item.description)+'</p>':'')+'</article>').join(''):'<p class="empty">Geen opgeslagen taken.</p>'
  const incidentHtml=(data.incidents||[]).length?(data.incidents||[]).map(item=>'<article class="row" style="display:block"><strong>'+escape(item.status)+(item.escalated_at&&!item.resolved_at?' · GEËSCALEERD':'')+'</strong><p style="white-space:pre-wrap">'+escape(item.message)+'</p><small>'+new Date(item.created_at).toLocaleString('nl-BE')+'</small></article>').join(''):'<p class="empty">Geen opgeslagen help oproepen.</p>'
  const inventoryHtml=(data.inventoryItems||[]).length?(data.inventoryItems||[]).map(item=>{const outstanding=(data.inventoryIssues||[]).filter(issue=>issue.item_id===item.id).reduce((sum,issue)=>sum+Number(issue.outstanding_quantity||0),0);return '<article class="row" style="display:block"><strong>'+escape(item.name)+'</strong><small>'+escape(workplaceName(item.workplace_id))+' · beschikbaar '+escape(item.available_quantity)+' · uitgegeven '+escape(item.issued_quantity)+' · beschadigd '+escape(item.damaged_quantity)+' · vermist '+escape(item.missing_quantity)+(outstanding?' · uitstaand '+escape(outstanding):'')+'</small></article>'}).join(''):'<p class="empty">Geen opgeslagen materiaalstatus.</p>'

  const documentHtml=documents.length?documents.map(item=>{const url=URL.createObjectURL(item.blob);return '<article class="row" style="display:block"><strong>'+escape(item.event_name)+' · '+escape(item.title)+'</strong>'+(item.description?'<p>'+escape(item.description)+'</p>':'')+'<small>'+escape(item.file_name)+'</small><p><a href="'+url+'" download="'+escape(item.file_name)+'" style="color:#c4b5fd;font-weight:800">OPEN OFFLINE BESTAND</a></p></article>'}).join(''):'<p class="empty">Geen offline belangrijke documenten opgeslagen.</p>'

  const sections=[
   section('Evenementen offline',eventHtml),
   section('Werkplekken offline',workplaceHtml),
   section('Shifts offline',shiftHtml),
   section('Noodinformatie offline',emergencyHtml),
   section('Documenten offline',documentHtml),
   section('Instructies offline',briefingHtml),
   section('Taken offline',taskHtml),
   section('Help offline',incidentHtml),
   section('Materiaal offline',inventoryHtml),
  ]
  for(const item of sections){if(queue)main.insertBefore(item,queue);else main.append(item)}

  const checklistSection=section('Checklists offline','')
  const checklistHost=document.createElement('div')
  checklistSection.append(checklistHost)
  if(!(data.checklists||[]).length)checklistHost.innerHTML='<p class="empty">Geen opgeslagen operationele checklists.</p>'
  for(const checklist of data.checklists||[]){
   const article=document.createElement('article');article.className='row';article.style.display='block'
   const title=document.createElement('strong');title.textContent=checklist.title+' · '+workplaceName(checklist.workplace_id)
   article.append(title)
   if(checklist.description){const p=document.createElement('p');p.textContent=checklist.description;article.append(p)}
   for(const point of checklist.items||[]){
    const row=document.createElement('div');row.className='row'
    const label=document.createElement('span');label.textContent=(point.completed_at?'✓ ':'')+point.label
    const action=btn(point.completed_at?'HEROPENEN':'AFVINKEN',async()=>{
      await enqueue(userId,'checklist_item',{item_id:point.id,complete:!point.completed_at})
      action.disabled=true
      action.textContent='WACHT OP SYNC'
    },Boolean(point.requires_photo&&!point.completed_at))
    row.append(label,action);article.append(row)
   }
   checklistHost.append(article)
  }
  if(queue)main.insertBefore(checklistSection,queue);else main.append(checklistSection)

  const guestSection=section('Inkom & Guestlist offline','')
  const guestHost=document.createElement('div');guestSection.append(guestHost)
  if(!(data.guestlist||[]).length)guestHost.innerHTML='<p class="empty">Geen opgeslagen guestlist.</p>'
  for(const entry of data.guestlist||[]){
   const row=document.createElement('div');row.className='row'
   const left=document.createElement('div')
   left.innerHTML='<strong>'+escape(entry.name)+'</strong><small>'+escape(eventName(entry.event_id))+' · '+escape(entry.entry_type)+' · '+escape(entry.spots_checked_in)+'/'+escape(entry.spots_total)+' binnen</small>'
   const action=btn('CHECK-IN +1',async()=>{
    await enqueue(userId,'guestlist_checkin',{entry_id:entry.id,delta:1})
    action.disabled=true;action.textContent='WACHT OP SYNC'
   },entry.spots_checked_in>=entry.spots_total)
   row.append(left,action);guestHost.append(row)
  }
  if(queue)main.insertBefore(guestSection,queue);else main.append(guestSection)

  const saleSection=section('Verkoop offline','')
  const saleHost=document.createElement('div');saleSection.append(saleHost)
  if(!(data.saleItems||[]).length)saleHost.innerHTML='<p class="empty">Geen verkoopitems offline beschikbaar.</p>'
  for(const item of data.saleItems||[]){
   const article=document.createElement('article');article.className='row';article.style.display='block'
   const title=document.createElement('strong');title.textContent=item.name+' · '+euro(item.sale_price_cents)
   const meta=document.createElement('small');meta.textContent=eventName(item.event_id)+' · '+workplaceName(item.workplace_id)+' · '+item.available_quantity+' beschikbaar'
   const controls=document.createElement('div');controls.className='actions'
   for(const method of ['cash','card']){
    const action=btn(method==='cash'?'CASH +1':'KAART +1',async()=>{
      await enqueue(userId,'sale',{item_id:item.id,quantity:1,payment_method:method})
      action.disabled=true;action.textContent='WACHT OP SYNC'
    })
    controls.append(action)
   }
   article.append(title,meta,controls);saleHost.append(article)
  }
  if(queue)main.insertBefore(saleSection,queue);else main.append(saleSection)
 }
 run().catch(()=>{})
})()
