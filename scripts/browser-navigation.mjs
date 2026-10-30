/** Retry only interrupted read-only navigations, never form submissions. */
export async function gotoReady(page,url){
 for(let attempt=0;attempt<3;attempt++){
  try{
   const response=await page.goto(url,{waitUntil:'load',timeout:30000})
   await page.waitForLoadState('networkidle',{timeout:10000}).catch(()=>{})
   return response
  }catch(error){
   if(!/ERR_ABORTED|Navigation interrupted/i.test(String(error.message))||attempt===2)throw error
   await page.waitForLoadState('networkidle',{timeout:10000}).catch(()=>{})
  }
 }
 throw Error('Navigation did not complete')
}
