// Anonymous login screenshot stabilization only. No style injection, mask,
 // pixel tolerance, changed geometry, or fallback to a previous capture.
 // Both documents must independently settle to two identical frames.
export async function stableLoginScreenshot(page){
 await page.bringToFront()
 let previous=null
 for(let captures=1;captures<=4;captures++){
  await page.evaluate(async()=>{
   await document.fonts.ready
   await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)))
  })
  const pixels=await page.screenshot({fullPage:true,animations:"disabled",caret:"hide"})
  if(previous!==null&&previous.equals(pixels))return {pixels,stable:true,captures}
  previous=pixels
 }
 return {pixels:previous,stable:false,captures:4}
}
