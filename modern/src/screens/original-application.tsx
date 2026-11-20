import {originalSearchParams} from '../compat/search-params'
import {Component,Suspense,lazy,startTransition,useEffect,useMemo,useState,type ReactNode,type ComponentType} from 'react'
import {Navigate,Route,Routes,useLocation,useParams} from 'react-router-dom'
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
import {OriginalRequest,originalRoutePromise} from '../original/runtime'
import styles from '../app.css?inline'

const pages=routes.map(r=>({...r,Page:lazy(r.load)}))
class Boundary extends Component<{children:ReactNode;reset:()=>void;revision:string},{error:Error|null;revision:string}>{
 state={error:null as Error|null,revision:this.props.revision}
 static getDerivedStateFromProps(props:{revision:string},state:{revision:string}){return props.revision!==state.revision?{error:null,revision:props.revision}:null}
 static getDerivedStateFromError(error:Error){return {error}}
 render(){if(this.state.error?.message==='DOCUMENT_NOT_FOUND')return <NotFound/>;if(this.state.error?.message==='DOCUMENT_REDIRECT')return null;return this.state.error?<OriginalError error={this.state.error} reset={()=>{this.setState({error:null});this.props.reset()}}/>:this.props.children}
}
function Page({Screen,revision}:{Screen:ComponentType<Record<string,unknown>>;revision:string}){
 const values=useParams(),location=useLocation()
 const params=useMemo(()=>originalRoutePromise(Object.fromEntries(Object.entries(values).filter(([name])=>name!=='*'))),[values])
 const searchParams=useMemo(()=>originalRoutePromise(originalSearchParams(location.search)),[location.search])
 return <Boundary revision={revision} reset={()=>window.dispatchEvent(new Event('upt-source-refresh'))}><Suspense fallback={location.pathname==='/settings'?<SettingsLoading/>:<Loading/>}><Screen params={params} searchParams={searchParams}/></Suspense></Boundary>
}
function AuthenticatedRoutes(){
 const location=useLocation(),auth=useAuth()
 const [revision,setRevision]=useState(0)
 useEffect(()=>{const refresh=()=>startTransition(()=>setRevision(n=>n+1));window.addEventListener('upt-source-refresh',refresh);return()=>window.removeEventListener('upt-source-refresh',refresh)},[])
 useEffect(()=>{document.body.classList.add('font-sans','antialiased');return()=>document.body.classList.remove('font-sans','antialiased')},[])
 // Scope and error state are discarded on identity, role, query or route change.
 const identityKey=[auth.user?.id,auth.roleMode,auth.isOwner].join(':')
 const requestKey=[identityKey,location.key,revision].join(':')
 const content=useMemo(()=><Routes>{pages.map(({path,Page:Screen})=>{
  let node=<Page Screen={Screen} revision={requestKey}/>
  // The authoritative original /shifts page checks the signed user and then
  // redirects to /workplaces. A Next server-render redirect cannot always
  // complete during a Vite client Suspense render. Preserve that exact
  // original URL outcome after the existing authenticated profile gate.
  // This is NOT a new shortcut or workflow: /shifts remains the original
  // compatibility URL and /workplaces remains its original destination.
  if(path==='/shifts'&&auth.user&&auth.profile)
   node=<Navigate to="/workplaces" replace/>
  if(path.startsWith('/portals/administration'))node=<AdministrationLayout>{node}</AdministrationLayout>
  if(path.startsWith('/portals/promotion'))node=<PromotionLayout>{node}</PromotionLayout>
  if(!['/maker-mode','/qr','/q/:code'].includes(path)&&!path.startsWith('/god-mode'))node=<AppLayout>{node}</AppLayout>
  return <Route key={path} path={path} element={node}/>
 })}<Route path="*" element={<AppLayout><NotFound/></AppLayout>}/></Routes>,[requestKey])
 if(auth.loading)return <Loading/>
 // Each original layout/page owns its exact login, approval and Owner
 // redirect. A generic outer redirect would change QR and Maker entry flows.
 return <OriginalRequest key={identityKey} revision={requestKey}><Boundary key={identityKey} revision={requestKey} reset={()=>setRevision(n=>n+1)}><Suspense fallback={<Loading/>}>{content}</Suspense></Boundary></OriginalRequest>
}
export default function OriginalApplication(){
 return <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange><style>{styles}</style>
  <AuthProvider><AdminSelectionProvider><WorkspaceContinuity/><LazyPwaRegister/><FirstUseInstallPrompt/><PushPermissionPrompt/><SaveSuccessToaster/><AuthenticatedRoutes/><Toaster richColors position="top-right"/></AdminSelectionProvider></AuthProvider>
  <LocaleSync clientRendered/>
 </ThemeProvider>
}
