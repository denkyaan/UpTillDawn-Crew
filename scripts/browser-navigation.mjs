/** Retry only interrupted read-only navigations, never form submissions. */
const requestedTimeout=Number(process.env.UPT_BROWSER_TIMEOUT_MS??30000)
export const browserTimeoutMs=Number.isInteger(requestedTimeout)&&requestedTimeout>=1000&&requestedTimeout<=120000?requestedTimeout:30000
export async function gotoReady(page,url){
 for(let attempt=0;attempt<3;attempt++){
  try{
   const response=await page.goto(url,{waitUntil:'commit',timeout:browserTimeoutMs})
   // Background sync, chat and streaming responses can remain active after
   // the page is usable. Wait for the visible application instead of idle I/O.
   const main=page.locator('main').first()
   await main.waitFor({state:'visible',timeout:browserTimeoutMs})
   await page.waitForFunction(()=>![...document.querySelectorAll('[data-route-loading]')].some(element=>element.getClientRects().length>0),undefined,{timeout:browserTimeoutMs})
   // Chat and context-dependent empty states need not contain a heading.
   // A route skeleton has no visible text; do not count it as loaded content.
   await page.waitForFunction(()=>[...document.querySelectorAll('main')].some(element=>element.innerText.trim().length>0),undefined,{timeout:browserTimeoutMs})
   return response
  }catch(error){
   if(!/ERR_ABORTED|Navigation interrupted/i.test(String(error.message))||attempt===2)throw error
   await page.locator('body').waitFor({state:'visible',timeout:10000}).catch(()=>{})
  }
 }
 throw Error('Navigation did not complete')
}
