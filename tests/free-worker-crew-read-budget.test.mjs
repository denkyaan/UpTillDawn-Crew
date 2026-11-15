import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {signedDirectoryPhotoUrls} from '../lib/crew/signed-directory-photo-urls.ts'
const read=path=>readFileSync(path,'utf8')

test('chat signs 250 private directory members in three storage calls, not 250',async()=>{
 let calls=0
 const members=Array.from({length:250},(_,i)=>({id:String(i),profile_photo_url:'profiles/'+i+'.jpg'}))
 const result=await signedDirectoryPhotoUrls(members,async(paths,ttl)=>{
  calls++
  assert.equal(ttl,3600)
  assert.ok(paths.length>0&&paths.length<=100)
  return {data:paths.map(path=>({path,signedUrl:'https://example.test/private/'+path,error:null})),error:null}
 })
 assert.equal(calls,3)
 assert.equal(Object.keys(result).length,250)
 assert.equal(result['0'],'https://example.test/private/profiles/0.jpg')
 assert.equal(result['249'],'https://example.test/private/profiles/249.jpg')
})

test('deduplicate identical private photo paths and fail closed on signing failures',async()=>{
 let requested=[]
 const result=await signedDirectoryPhotoUrls([
  {id:'a',profile_photo_url:'same.jpg'}, {id:'b',profile_photo_url:'same.jpg'},
  {id:'c',profile_photo_url:'denied.jpg'}, {id:'d',profile_photo_url:null},
 ],async(paths)=>{requested=paths;return {data:[
   {path:'same.jpg',signedUrl:'https://example.test/signed',error:null},
   {path:'denied.jpg',signedUrl:'',error:'forbidden'},
  ],error:null}})
 assert.deepEqual(requested,['same.jpg','denied.jpg'])
 assert.deepEqual(result,{a:'https://example.test/signed',b:'https://example.test/signed'})
 assert.deepEqual(await signedDirectoryPhotoUrls([{id:'x',profile_photo_url:'x.jpg'}],async()=>{throw Error('storage failure')}),{})
 let invoked=false
 assert.deepEqual(await signedDirectoryPhotoUrls([],async()=>{invoked=true;throw Error('unused')}),{})
 assert.equal(invoked,false)
})

test('chat and Events server data reads remain RLS-bound and respect outgoing connection budgets',()=>{
 const chat=read('app/(app)/chat/page.tsx'),events=read('app/(app)/events/page.tsx')
 assert.match(chat,/\]=await boundedQueries\(\[/)
 assert.match(events,/\]=await boundedQueries\(\[/)
 assert.match(chat,/\],3\)/)
 assert.match(events,/\],3\)/)
 assert.match(chat,/createSignedUrls\(paths,expiresIn\)/)
 assert.doesNotMatch(chat,/createSignedUrl\(member\.profile_photo_url/)
 assert.match(chat,/upt_private_chat_peers/)
 assert.match(events,/event_emergency_information/)
 assert.match(events,/adminShiftsByEventAndUser/)
 assert.match(events,/confirmedCounts\.get\(event\.id\)/)
 assert.match(events,/ownAvailabilityByEvent\.get\(event\.id\)/)
})
