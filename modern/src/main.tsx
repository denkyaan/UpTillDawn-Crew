import {StrictMode,Suspense,lazy,useEffect,useState,type FormEvent,type ReactNode} from "react"
import {createRoot} from "react-dom/client"
import {BrowserRouter,Link,NavLink,Navigate,Outlet,Route,Routes} from "react-router-dom"
import {SessionProvider,useSession} from "./lib/session"
import {copy,deviceLocale,resolveLocale,type Locale} from "./shared/i18n"
import {supabase} from "./lib/supabase"
import "./styles.css"

const Events=lazy(()=>import("./screens/events"))
const Tasks=lazy(()=>import("./screens/tasks"))
const Chats=lazy(()=>import("./screens/chats"))
const Finance=lazy(()=>import("./screens/finance"))

function Authenticated({children}:{children:ReactNode}){
 const state=useSession()
 const [locale,setLocale]=useState<Locale>(()=>deviceLocale())
 useEffect(()=>{document.documentElement.lang=locale},[locale])
 const t=copy(locale)
 if(state.status==="checking")return <main className="layout" role="status">{t.loading}</main>
 if(state.status==="anonymous")return <Navigate to="/login" replace/>
 if(state.status==="denied")return <main className="auth" role="alert">{t.unavailable} — account approval required</main>
 if(state.status==="error")return <main className="auth" role="alert">{t.unavailable}<button className="primary" onClick={()=>void state.refresh()}>{t.refresh}</button></main>
 const canAdmin=state.portals.includes("administration")
 return <>
  <a className="sr-only skip" href="#main">Skip to content</a>
  <header className="bar"><div className="brand">UP TILL DAWN <span className="muted">· local-first candidate</span></div>
   <nav aria-label={t.portal} className="nav">
    <NavLink to="/" end>{t.home}</NavLink>
    <NavLink to="/events">{t.events}</NavLink>
    <NavLink to="/tasks">{t.tasks}</NavLink>
    <NavLink to="/chat">{t.chat}</NavLink>
    {canAdmin&&<NavLink to="/portals/administration/finance">{t.finance}</NavLink>}
   </nav>
   <div className="row"><label className="muted" htmlFor="language">UI
    <select id="language" value={locale} onChange={e=>setLocale(resolveLocale(e.target.value))}>
     <option value="nl">NL</option><option value="fr">FR</option><option value="en">EN</option><option value="de">DE</option>
    </select></label>
    <button type="button" onClick={()=>void state.signOut()}>{t.logout}</button></div>
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
 const locale=deviceLocale(),t=copy(locale)
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
function Home(){
 const {identity,portals}=useSession()
 return <><h1>UpTillDawn</h1><p className="muted">{identity?.full_name||"Crew"} · {identity?.effective_role||identity?.role}</p>
 <section className="grid">
  <article className="card"><h2>Events</h2><p>Live RLS-limited upcoming events.</p><Link to="/events">View events</Link></article>
  <article className="card"><h2>Tasks</h2><p>Personal RLS-limited task assignments.</p><Link to="/tasks">View tasks</Link></article>
  <article className="card"><h2>Chat</h2><p>Channels available to this account.</p><Link to="/chat">View channels</Link></article>
  {portals.includes("administration")&&<article className="card"><h2>Finance</h2><p>Read-only financial summary.</p><Link to="/portals/administration/finance">View finance</Link></article>}
 </section></>
}
function PortalGuard({portal,children}:{portal:"events"|"promotion"|"administration";children:ReactNode}){
 const session=useSession()
 return session.portals.includes(portal)?<>{children}</>:<p role="alert" className="notice">No approved access to this portal.</p>
}
function Missing(){return <section className="card" role="status"><h1>Migration incomplete</h1><p>Deze functie blijft beschikbaar in de bestaande UpTillDawn-app. De nieuwe app mag nog niet in productie worden gebruikt.</p><Link to="/">Home</Link></section>}
function App(){
 return <BrowserRouter><SessionProvider>
  <Routes>
   <Route path="/login" element={<SignIn/>}/>
   <Route element={<Authenticated><Outlet/></Authenticated>}>
    <Route index element={<Home/>}/>
    <Route path="/events" element={<Suspense fallback="Loading events…"><Events/></Suspense>}/>
    <Route path="/tasks" element={<Suspense fallback="Loading tasks…"><Tasks/></Suspense>}/>
    <Route path="/chat" element={<Suspense fallback="Loading channels…"><Chats/></Suspense>}/>
    <Route path="/portals" element={<Home/>}/>
    <Route path="/portals/administration" element={<PortalGuard portal="administration"><Home/></PortalGuard>}/>
    <Route path="/portals/administration/finance" element={<PortalGuard portal="administration"><Suspense fallback="Loading finance…"><Finance/></Suspense></PortalGuard>}/>
    <Route path="/portals/promotion" element={<PortalGuard portal="promotion"><Chats/></PortalGuard>}/>
    <Route path="/god/*" element={<Missing/>}/>
    <Route path="*" element={<Missing/>}/>
   </Route>
  </Routes>
 </SessionProvider></BrowserRouter>
}
createRoot(document.getElementById("root")!).render(<StrictMode><App/></StrictMode>)
if(import.meta.env.PROD&&"serviceWorker" in navigator)
 window.addEventListener("load",()=>{void navigator.serviceWorker.register("/sw.js").catch(()=>{})})
