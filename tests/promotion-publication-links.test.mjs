import test from 'node:test'
import assert from 'node:assert/strict'
import {promotionPublicationLinks} from '../lib/promotion-publication-links.ts'

test('promotion instructions expose real social destinations and preserve their query parameters',()=>{
 assert.deepEqual(promotionPublicationLinks('Instagram: https://www.instagram.com/p/test/?img_index=2 Facebook: https://www.facebook.com/events/123/'),[
  {platform:'instagram',url:'https://www.instagram.com/p/test/?img_index=2'},
  {platform:'facebook',url:'https://www.facebook.com/events/123/'},
 ])
})
test('punctuation and repeated links cannot create duplicate buttons',()=>{
 assert.deepEqual(promotionPublicationLinks('(https://instagram.com/p/test/). https://instagram.com/p/test/'),[{platform:'instagram',url:'https://instagram.com/p/test/'}])
})
test('credentials, misleading hosts, unusual ports and other protocols are never linked',()=>{
 for(const value of ['javascript:alert(1)','https://instagram.com.attacker.test/post','https://facebook.com@attacker.test/post','https://user:password@facebook.com/post','https://facebook.com:8443/post','https://notfacebook.com/post','data:text/html,test'])assert.deepEqual(promotionPublicationLinks(value),[])
})
test('official HTTP links are upgraded to HTTPS and the rendered list is bounded',()=>{
 assert.equal(promotionPublicationLinks('http://facebook.com/events/123')[0].url,'https://facebook.com/events/123')
 assert.equal(promotionPublicationLinks(Array.from({length:20},(_,n)=>'https://instagram.com/p/'+n).join(' ')).length,8)
})
