import {StrictMode,Suspense,lazy,useEffect,useState,type FormEvent,type ReactNode} from "react"
import {createRoot} from "react-dom/client"
import {BrowserRouter,Link,NavLink,Navigate,Outlet,Route,Routes,useLocation} from "react-router-dom"
import {SessionProvider,useSession} from "./lib/session"
import {resolveLocale} from "./shared/i18n"
import {useLocale,setLocale} from "./lib/use-locale"
import {canRememberRoute,preferredPortalRoute,rememberPortalRoute,type PortalAccess} from "./shared/portal-preference"
import "./styles.css"

const Events=lazy(()=>import("./screens/events"))
const Tasks=lazy(()=>import("./screens/tasks"))
const Chats=lazy(()=>import("./screens/chats"))
const Finance=lazy(()=>import("./screens/finance"))
const Crew=lazy(()=>import("./screens/crew"))
const Briefings=lazy(()=>import("./screens/briefings"))
const Operations=lazy(()=>import("./screens/operations"))
const Responsible=lazy(()=>import("./screens/responsible"))
const Administration=lazy(()=>import("./screens/administration"))
const Promotion=lazy(()=>import("./screens/promotion"))
const Notifications=lazy(()=>import("./screens/notifications"))
const Profile=lazy(()=>import("./screens/profile"))
const MakerDiagnostics=lazy(()=>import("./screens/maker-diagnostics"))
const QrWorkflow=lazy(()=>import("./screens/qr-workflow"))
const ProviderOauthCallback=lazy(()=>import("./screens/provider-oauth-callback"))

function PortalMemory(){
 const {identity,portals,status}=useSession()
 const {pathname}=useLocation()
 useEffect(()=>{
  if(status!=="ready"||!identity)return
  const access:PortalAccess={userId:identity.id,role:identity.role,isOwner:identity.is_owner,portals}
  if(canRememberRoute(pathname,access))rememberPortalRoute(pathname,access)
 },[status,identity,portals,pathname])
 return null
}
function Authenticated({children}:{children:ReactNode}){
 const state=useSession()
 const {locale,t}=useLocale()
 if(state.status==="checking")return <main className="layout" role="status">{t.loading}</main>
 if(state.status==="anonymous")return <Navigate to="/login" replace/>
 if(state.status==="denied")return <main className="auth" role="alert">{t.unavailable} — account approval required</main>
 if(state.status==="error")return <main className="auth" role="alert">{t.unavailable}<button className="primary" onClick={()=>void state.refresh()}>{t.refresh}</button></main>
 const canAdmin=state.portals.includes("administration")
 const canEvents=state.portals.includes("events")
 return <>
  <PortalMemory/>
  <a className="sr-only skip" href="#main">Skip to content</a>
  <header className="bar"><div className="brand">UP TILL DAWN <span className="muted">· local-first candidate</span></div>
   <nav aria-label={t.portal} className="nav">
    <NavLink to="/overview">{state.identity?.is_owner?t.normalApp:t.home}</NavLink>
    {canEvents&&<NavLink to="/events">{t.events}</NavLink>}
    {canEvents&&<NavLink to="/crew">{t.crew}</NavLink>}
    {canEvents&&<NavLink to="/briefings">{t.briefings}</NavLink>}
    {canEvents&&<NavLink to="/qr">{t.qr}</NavLink>}
    {canEvents&&<NavLink to="/tasks">{t.tasks}</NavLink>}
    {canEvents&&<NavLink to="/chat">{t.chat}</NavLink>}
    {canEvents&&<NavLink to="/operations">{t.operations}</NavLink>}
    {(state.identity?.role==="responsible_lead"||state.identity?.role==="admin"||state.identity?.is_owner)&&
     <NavLink to="/responsible">{t.responsible}</NavLink>}
    {state.portals.includes("promotion")&&<NavLink to="/portals/promotion">{t.promotion}</NavLink>}
    {canAdmin&&<NavLink to="/portals/administration">{t.administration}</NavLink>}
    <NavLink to="/notifications">{t.notifications}</NavLink>
   </nav>
   <div className="row"><label className="muted" htmlFor="language">UI
    <select id="language" value={locale} onChange={e=>setLocale(resolveLocale(e.target.value))}>
     <option value="nl">NL</option><option value="fr">FR</option><option value="en">EN</option><option value="de">DE</option>
    </select></label>
    {state.identity?.is_owner&&<NavLink to="/maker/diagnostics">God Mode</NavLink>}
    <NavLink to="/profile">{t.profile}</NavLink>
    <button type="button" onClick={()=>void state.signOut().catch(()=>{})}>{t.logout}</button></div>
  </header>
  <main id="main" className="layout">
   <div className="notice" role="note">{t.readOnly}</div>
   {children}
  </main>
 </>
}
function SignIn(){
 const state=useSession()
 const [error,setError]=useState("")
 const [busy,setBusy]=useState(false)
 const {t}=useLocale()
 if(state.status==="ready")return <Navigate to="/" replace/>
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault()
  const form=new FormData(e.currentTarget)
  const email=String(form.get("email")||"").trim()
  const password=String(form.get("password")||"")
  if(!email||!password)return
  setBusy(true);setError("")
  try{await state.signIn(email,password)}
  catch{setError("Login kon niet worden bevestigd. Controleer je gegevens of probeer opnieuw.")}
  finally{setBusy(false)}
 }
 return <main className="auth"><section className="card"><h1>UP TILL DAWN — {t.login}</h1>
  <p className="muted">{t.readOnly}</p><form onSubmit={e=>void submit(e)}>
   <label>E-mail<input type="email" name="email" autoComplete="username" required/></label>
   <label>Password<input type="password" name="password" autoComplete="current-password" required/></label>
   {error&&<p className="error" role="alert">{error}</p>}
   <button className="primary" disabled={busy}>{busy?t.loading:t.login}</button>
  </form></section></main>
}
function Landing(){
 const {identity,portals}=useSession()
 const {t}=useLocale()
 if(!identity)return null
 const access:PortalAccess={userId:identity.id,role:identity.role,isOwner:identity.is_owner,portals}
 const destination=preferredPortalRoute(access)
 if(destination)return destination==="/overview"?<Home/>:<Navigate to={destination} replace/>
 return <section className="card mode-choice"><h1>{t.choosePortal}</h1>
  <p className="muted">{t.preferenceNote}</p>
  <nav className="row" aria-label={t.portal}><Link className="mode-link" to="/overview">{t.normalApp}</Link>
   <Link className="mode-link" to="/maker/diagnostics">God Mode</Link></nav>
 </section>
}
function Home(){
 const {identity}=useSession()
 return <><h1>UpTillDawn</h1>
  <p className="muted">{identity?.full_name||"Crew"} · {identity?.effective_role||identity?.role}</p>
  <section className="card"><h2>Local-first migratie</h2>
   <p>Gebruik de portaalnavigatie. De huidige app blijft leidend voor nog niet gemigreerde functies.</p>
   <p className="muted">Persoonlijke schermen laden uitsluitend benodigde RLS-gegevens op wanneer je ze opent. Geen zware server-rendering per navigatie.</p>
  </section>
 </>
}
function PortalGuard({portal,children}:{portal:"events"|"promotion"|"administration";children:ReactNode}){
 const session=useSession()
 return session.portals.includes(portal)?<>{children}</>:<p role="alert" className="notice">No approved access to this portal.</p>
}
function ResponsibleGuard({children}:{children:ReactNode}){
 const {identity}=useSession()
 return identity&&(identity.role==="responsible_lead"||identity.role==="admin"||identity.is_owner)
  ?<>{children}</>:<p role="alert" className="notice">Geen goedgekeurde toegang tot verantwoordelijkheidsbeheer.</p>
}
function MakerGuard({children}:{children:ReactNode}){
 const {identity}=useSession()
 return identity?.is_owner?<>{children}</>:<p role="alert" className="notice">Maker-toegang vereist.</p>
}
function Missing(){return <section className="card" role="status"><h1>Migration incomplete</h1><p>Deze functie blijft beschikbaar in de bestaande UpTillDawn-app. De nieuwe app mag nog niet in productie worden gebruikt.</p><Link to="/">Home</Link></section>}
function App(){
 return <BrowserRouter><SessionProvider>
  <Routes>
   <Route path="/login" element={<SignIn/>}/>
   <Route element={<Authenticated><Outlet/></Authenticated>}>
    <Route index element={<Landing/>}/>
    <Route path="/overview" element={<Home/>}/>
    <Route element={<PortalGuard portal="events"><Outlet/></PortalGuard>}>
     <Route path="/events" element={<Suspense fallback="Loading events…"><Events/></Suspense>}/>
     <Route path="/tasks" element={<Suspense fallback="Loading tasks…"><Tasks/></Suspense>}/>
     <Route path="/chat" element={<Suspense fallback="Loading channels…"><Chats/></Suspense>}/>
     <Route path="/crew" element={<Suspense fallback="Planning laden…"><Crew/></Suspense>}/>
     <Route path="/briefings" element={<Suspense fallback="Briefings laden…"><Briefings/></Suspense>}/>
     <Route path="/qr" element={<Suspense fallback="QR-aanvraag laden…"><QrWorkflow/></Suspense>}/>
     <Route path="/operations" element={<Suspense fallback="Werkplekken laden…"><Operations/></Suspense>}/>
    </Route>
    <Route path="/notifications" element={<Suspense fallback="Meldingen laden…"><Notifications/></Suspense>}/>
    <Route path="/profile" element={<Suspense fallback="Profiel laden…"><Profile/></Suspense>}/>
    <Route path="/integrations/oauth/callback/:provider" element={<PortalGuard portal="administration">
     <Suspense fallback="Beveiligde koppeling laden…"><ProviderOauthCallback/></Suspense>
    </PortalGuard>}/>
    <Route path="/responsible" element={<ResponsibleGuard><Suspense fallback="Planning laden…"><Responsible/></Suspense></ResponsibleGuard>}/>
    <Route path="/portals" element={<Home/>}/>
    <Route path="/portals/administration" element={<PortalGuard portal="administration"><Suspense fallback="Administratie laden…"><Administration/></Suspense></PortalGuard>}/>
    <Route path="/portals/administration/finance" element={<PortalGuard portal="administration"><Suspense fallback="Loading finance…"><Finance/></Suspense></PortalGuard>}/>
    <Route path="/portals/promotion" element={<PortalGuard portal="promotion"><Suspense fallback="Promotie laden…"><Promotion/></Suspense></PortalGuard>}/>
    <Route path="/portals/promotion/chat" element={<PortalGuard portal="promotion"><Suspense fallback="Chat laden…"><Chats scope="promotion"/></Suspense></PortalGuard>}/>
    <Route path="/maker/diagnostics" element={<MakerGuard><Suspense fallback="Makerdiagnostiek laden…"><MakerDiagnostics/></Suspense></MakerGuard>}/>
    <Route path="/god/*" element={<Missing/>}/>
    <Route path="*" element={<Missing/>}/>
   </Route>
  </Routes>
 </SessionProvider></BrowserRouter>
}
createRoot(document.getElementById("root")!).render(<StrictMode><App/></StrictMode>)
if(import.meta.env.PROD&&"serviceWorker" in navigator)
 window.addEventListener("load",()=>{void navigator.serviceWorker.register("/sw.js").catch(()=>{})})
