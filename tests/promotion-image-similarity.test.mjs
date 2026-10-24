import test from 'node:test'
import assert from 'node:assert/strict'
import {comparePromotionImages} from '../lib/promotion-image-similarity.mjs'
const image=(w,h,pixel)=>{const data=new Uint8Array(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;const v=pixel(x,y);data.set([v,v,v,255],i)}return {width:w,height:h,data}}
test('identical detailed images yield a strong review signal',()=>{
 const a=image(64,64,(x,y)=>((x*17+y*29)^((x*y)%251))%256)
 assert.ok(comparePromotionImages(a,a)>0.99)
})
test('flat images never count as visual matches',()=>{
 const a=image(64,64,()=>120)
 assert.equal(comparePromotionImages(a,a),0)
})
test('unrelated visual patterns score below an identical match',()=>{
 const a=image(64,64,(x,y)=>((x*17+y*29)^((x*y)%251))%256)
 const b=image(64,64,(x,y)=>((x*41+y*7)^((x+y)%53))%256)
 assert.ok(comparePromotionImages(a,b)<comparePromotionImages(a,a))
})
test('invalid pixel buffers are rejected',()=>{
 assert.throws(()=>comparePromotionImages({width:64,height:64,data:new Uint8Array(5)},image(64,64,()=>0)),TypeError)
})
