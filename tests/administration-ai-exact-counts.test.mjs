import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const route=readFileSync('app/api/administration/assistant/route.ts','utf8')
test('administration AI uses exact head-only counts with explicit statuses',()=>{
 for(const table of ['admin_financial_documents','admin_artist_bookings','admin_roster_proposals','timesheets']){
  assert.ok(route.includes('db.from("'+table+'").select("id",{count:"exact",head:true})'),table)
 }
 for(const key of ['financialDocumentsAwaitingCompletion','artistBookingsInProgress','submittedRosterProposals','submittedTimesheets']){
  assert.match(route,new RegExp(key+':'))
 }
 assert.match(route,/Counts marked complete=true are exact for their explicitly listed statuses only/)
})
test('count errors are represented as unavailable, not zero',()=>{
 for(const variable of ['financialDocumentCount','openArtistBookingCount','pendingRosterCount']){
  assert.ok(route.includes(variable+'.error||'+variable+'.count==null?{available:false}'))
 }
})
