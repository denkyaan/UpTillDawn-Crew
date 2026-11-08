import test from 'node:test'
import assert from 'node:assert/strict'
import {isEntranceWorkplace,WEEZTIX_SCANNER_LINKS} from '../lib/weeztix-scanner.ts'

test('scanner is offered for entrance labels in all supported languages',()=>{
 for(const name of ['Inkom','Ticket scan/inkom','Inkom & Guestlist','Ticket Scan / Inkom','ENTRANCE','Entrée','Eingang','Contrôle des billets','Guest list + Entrance'])assert.equal(isEntranceWorkplace(name),true,name)
})
test('sales, backstage and unrelated posts do not acquire an entrance scanner',()=>{
 for(const name of ['Bar','Merch','Tokens','Backstage','Guestlist','Merch / Ticket scan','Backstage entrance','Bar - Inkom','','Inkom /'])assert.equal(isEntranceWorkplace(name),false,name)
})
test('vendor destinations use verified public HTTPS pages without embedded login data',()=>{
 assert.equal(new URL(WEEZTIX_SCANNER_LINKS.ios).pathname,'/be/app/weeztix-ticket-scanner/id1327353743')
 assert.equal(new URL(WEEZTIX_SCANNER_LINKS.android).searchParams.get('id'),'com.scantickets.app.eventix')
 for(const value of Object.values(WEEZTIX_SCANNER_LINKS)){const url=new URL(value);assert.equal(url.protocol,'https:');assert.equal(url.username,'');assert.equal(url.password,'');assert.equal(url.hash,'')}
})
