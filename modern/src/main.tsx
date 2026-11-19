import {StrictMode,Suspense,lazy,useEffect} from 'react'
import {createRoot} from 'react-dom/client'
import {BrowserRouter,Route,Routes} from 'react-router-dom'
const OriginalAuth=lazy(()=>import('./screens/original-auth'))
const OriginalApplication=lazy(()=>import('./screens/original-application'))
function Metadata(){
 useEffect(()=>{
  const update=()=>{const language=document.documentElement.lang.split('-')[0];const link=document.querySelector<HTMLLinkElement>('link[rel="manifest"]');if(link&&['nl','fr','en','de'].includes(language))link.href='/manifest-'+language+'.webmanifest'}
  const observer=new MutationObserver(update);observer.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});update();return()=>observer.disconnect()
 },[])
 return null
}
function App(){
 return <BrowserRouter><Metadata/><Suspense fallback={null}><Routes>
  {['/login','/login/:portal','/signup','/forgot-password','/auth/reset-password','/verify-email','/pending-approval','/disabled','/unauthorized','/auth/recovery','/auth/confirm'].map(path=><Route key={path} path={path} element={<OriginalAuth/>}/>)}
  <Route path="*" element={<OriginalApplication/>}/>
 </Routes></Suspense></BrowserRouter>
}
createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>)
if(import.meta.env.PROD&&'serviceWorker' in navigator)
 window.addEventListener('load',()=>{void navigator.serviceWorker.register('/sw.js').catch(()=>{})})
