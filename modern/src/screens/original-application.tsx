import {Component,Suspense,lazy,useEffect,useMemo,useState,type ReactNode,type ComponentType} from 'react'
import {Route,Routes,useLocation,useParams} from 'react-router-dom'
import {ThemeProvider} from 'next-themes'
import {AuthProvider,useAuth} from 'main-source/lib/providers.tsx'
import {AdminSelectionProvider} from 'main-source/lib/admin-selection-context.tsx'
import {LazyPwaRegister} from 'main-source/components/lazy-client-bootstraps.tsx'
import {WorkspaceContinuity} from 'main-source/components/auth/workspace-continuity.tsx'
import {SaveSuccessToaster} from 'main-source/components/save-success-toaster.tsx'
import {Toaster} from 'main-source/components/ui/sonner.tsx'
import {PushPermissionPrompt} from 'main-source/components/push-permission-prompt.tsx'
import {FirstUseInstallPrompt} from 'main-source/components/first-use-install-prompt.tsx'
import {LocaleSync} from '@/components/locale-sync'
import AppLayout from 'main-source/app/(app)/layout.tsx'
import AdministrationLayout from 'main-source/app/(app)/portals/administration/layout.tsx'
import PromotionLayout from 'main-source/app/(app)/portals/promotion/layout.tsx'
import Loading from 'main-source/app/(app)/loading.tsx'
import SettingsLoading from 'main-source/app/(app)/settings/loading.tsx'
import OriginalError from 'main-source/app/(app)/error.tsx'
import NotFound from '../original/not-found'
import {routes} from 'main-source/routes'
import {OriginalRequest} from '../original/runtime'
import styles from '../app.css?inline'

const pages=routes.map(r=>({...r,Page:lazy(r.load)}))
class Boundary extends Component<{children:ReactNode;reset:()=>void},{error:Error|null}>{
 state={error:null as Error|null}
 static getDerivedStateFromError(error:Error){return {error}}
 render(){if(this.state.error?.message==='DOCUMENT_NOT_FOUND')return <NotFound/>;if(this.state.error?.message==='DOCUMENT_REDIRECT')return null;return this.state.error?<OriginalError error={this.state.error} reset={()=>{this.setState({error:null});this.props.reset()}}/>:this.props.children}
}
function Page({Screen}:{Screen:ComponentType<Record<string,unknown>>}){
 const values=useParams(),location=useLocation()
 const params=useMemo(()=>Promise.resolve(values),[values])
 const searchParams=useMemo(()=>Promise.resolve(Object.fromEntries(new URLSearchParams(location.search))),[location.search])
 return <Suspense fallback={location.pathname==='/settings'?<SettingsLoading/>:<Loading/>}><Screen params={params} searchParams={searchParams}/></Suspense>
}
function AuthenticatedRoutes(){
 const location=useLocation(),auth=useAuth()
 const [revision,setRevision]=useState(0)
 useEffect(()=>{const refresh=()=>setRevision(n=>n+1);window.addEventListener('upt-source-refresh',refresh);return()=>window.removeEventListener('upt-source-refresh',refresh)},[])
 useEffect(()=>{document.body.classList.add('font-sans','antialiased');return()=>document.body.classList.remove('font-sans','antialiased')},[])
 // Scope and error state are discarded on identity, role, query or route change.
 const requestKey=[auth.user?.id,auth.roleMode,location.key,revision].join(':')
 const content=useMemo(()=><Routes>{pages.map(({path,Page:Screen})=>{
  let node=<Page Screen={Screen}/>
  if(path.startsWith('/portals/administration'))node=<AdministrationLayout>{node}</AdministrationLayout>
  if(path.startsWith('/portals/promotion'))node=<PromotionLayout>{node}</PromotionLayout>
  if(!['/maker-mode','/qr','/q/:code'].includes(path)&&!path.startsWith('/god-mode'))node=<AppLayout>{node}</AppLayout>
  return <Route key={path} path={path} element={node}/>
 })}<Route path="*" element={<AppLayout><NotFound/></AppLayout>}/></Routes>,[])
 if(auth.loading)return <Loading/>
 if(!auth.user){window.location.replace('/login');return null}
 if(!auth.profile){window.location.replace('/pending-approval');return null}
 return <OriginalRequest revision={requestKey}><Boundary key={requestKey} reset={()=>setRevision(n=>n+1)}><Suspense fallback={<Loading/>}>{content}</Suspense></Boundary></OriginalRequest>
}
export default function OriginalApplication(){
 return <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange><style>{styles}</style>
  <AuthProvider><AdminSelectionProvider><WorkspaceContinuity/><LazyPwaRegister/><FirstUseInstallPrompt/><PushPermissionPrompt/><SaveSuccessToaster/><AuthenticatedRoutes/><Toaster richColors position="top-right"/></AdminSelectionProvider></AuthProvider>
  <LocaleSync clientRendered/>
 </ThemeProvider>
}
