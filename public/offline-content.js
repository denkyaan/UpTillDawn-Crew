(()=>{
 function req(r){return new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
 function shellDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open('uptilldawn-offline-shell',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
 function contentDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open('uptilldawn-offline-content',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('content'))r.result.createObjectStore('content',{keyPath:'userId'})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
 function escape(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
 function section(title,html){const el=document.createElement('section');el.className='card';el.innerHTML='<h2>'+escape(title)+'</h2>'+html;return el}
 async function run(){
  let userId='';const shell=await shellDb();try{const meta=await req(shell.transaction('meta').objectStore('meta').get('activeUserId'));userId=meta?.value||''}finally{shell.close()}
  if(!userId)return
  const db=await contentDb();let data;try{data=await req(db.transaction('content').objectStore('content').get(userId))}finally{db.close()}
  if(!data)return
  const main=document.querySelector('main');if(!main)return
  const queue=document.getElementById('queue')
  const emergencyHtml=(data.emergency||[]).length?(data.emergency||[]).map(item=>'<article class="row" style="display:block"><strong>'+escape(item.event_name)+' · '+escape(item.emergency_number)+'</strong>'+(item.event_address?'<p>'+escape(item.event_address)+'</p>':'')+(item.first_aid_contact?'<small>EHBO: '+escape(item.first_aid_contact)+'</small>':'')+(item.security_contact?'<small>Security: '+escape(item.security_contact)+'</small>':'')+(item.assembly_point?'<p><strong>Verzamelpunt:</strong> '+escape(item.assembly_point)+'</p>':'')+(item.procedure?'<p style="white-space:pre-wrap">'+escape(item.procedure)+'</p>':'')+'</article>').join(''):'<p class="empty">Geen opgeslagen noodinformatie.</p>'
  const briefingHtml=(data.briefings||[]).length?(data.briefings||[]).map(item=>'<article class="row" style="display:block"><strong>'+(item.kind==='personal'?'Persoonlijk · ':'')+escape(item.title)+' · v'+escape(item.version)+'</strong><p style="white-space:pre-wrap">'+escape(item.body)+'</p></article>').join(''):'<p class="empty">Geen opgeslagen instructies.</p>'
  const taskHtml=(data.tasks||[]).length?(data.tasks||[]).map(item=>'<article class="row" style="display:block"><strong>'+escape(item.title)+'</strong><small>'+escape(item.status)+'</small>'+(item.description?'<p style="white-space:pre-wrap">'+escape(item.description)+'</p>':'')+'</article>').join(''):'<p class="empty">Geen opgeslagen taken.</p>'
  const stamp='<small>Laatst online bijgewerkt: '+new Date(data.savedAt).toLocaleString('nl-BE')+'</small>'
  const emergency=section('Noodinformatie offline',stamp+emergencyHtml)
  const briefs=section('Instructies offline',briefingHtml)
  const tasks=section('Taken offline',taskHtml)
  if(queue){main.insertBefore(emergency,queue);main.insertBefore(briefs,queue);main.insertBefore(tasks,queue)}else{main.append(emergency,briefs,tasks)}
 }
 run().catch(()=>{})
})()
