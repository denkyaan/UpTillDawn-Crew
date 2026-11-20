import {StrictMode,Suspense,lazy,useEffect} from 'react'
import {createRoot} from 'react-dom/client'
import {BrowserRouter,Route,Routes,useNavigate} from 'react-router-dom'
const OriginalAuth=lazy(()=>import('./screens/original-auth'))
const OriginalApplication=lazy(()=>import('./screens/original-application'))
function NavigationBridge(){
 const navigate=useNavigate()
 useEffect(()=>{
  const go=(event:Event)=>{const path=(event as CustomEvent<string>).detail;if(typeof path==='string'&&path.startsWith('/')&&!path.startsWith('//')&&!path.includes('\\'))void navigate(path)}
  window.addEventListener('upt-source-navigate',go);return()=>window.removeEventListener('upt-source-navigate',go)
 },[navigate])
 return null
}
function Metadata(){
 useEffect(()=>{
  const update=()=>{const language=document.documentElement.lang.split('-')[0];const link=document.querySelector<HTMLLinkElement>('link[rel="manifest"]');if(link&&['nl','fr','en','de'].includes(language))link.href='/manifest-'+language+'.webmanifest'}
  const observer=new MutationObserver(update);observer.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});update();return()=>observer.disconnect()
 },[])
 return null
}
function App(){
 return <BrowserRouter><NavigationBridge/><Metadata/><Suspense fallback={null}><Routes>
  {['/login','/login/:portal','/signup','/forgot-password','/auth/reset-password','/verify-email','/pending-approval','/disabled','/unauthorized','/auth/recovery','/auth/confirm'].map(path=><Route key={path} path={path} element={<OriginalAuth/>}/>)}
  <Route path="*" element={<OriginalApplication/>}/>
 </Routes></Suspense></BrowserRouter>
}
createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>)
if(import.meta.env.PROD&&'serviceWorker' in navigator)
 window.addEventListener('load',()=>{void navigator.serviceWorker.register('/sw.js').catch(()=>{})})
