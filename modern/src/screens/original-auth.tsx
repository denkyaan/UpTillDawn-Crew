import {originalSearchParams} from '../compat/search-params'
import {useEffect,useState,Suspense,lazy,useMemo,type ReactNode} from "react"
import {useLocation} from "react-router-dom"
import {ThemeProvider} from "next-themes"
import LoginPage from "@/app/(auth)/login/page"
import AuthLayout from "@/app/(auth)/layout"



import loadPendingApproval from "@/app/(auth)/pending-approval/page"
import {LoginForm} from "@/components/auth/login-form"

import {LocaleSync} from "@/components/locale-sync"
import styles from "../auth.css?inline"

// Non-login routes keep the exact original components and behavior, but do
// not inflate the critical login payload for every visitor. React Router's
// existing Suspense boundary loads these only when the user navigates there.
const SignupPage=lazy(()=>import("@/app/(auth)/signup/page"))
const ResetPasswordPage=lazy(()=>import("@/app/auth/reset-password/page"))
const VerifyEmailClient=lazy(()=>import("@/app/(auth)/verify-email/verify-email-client"))
const ForgotPasswordForm=lazy(()=>import("@/components/auth/forgot-password-form"))

const additionalPublic={
 '/disabled':lazy(()=>import('main-source/app/(auth)/disabled/page.tsx')),
 '/unauthorized':lazy(()=>import('main-source/app/(auth)/unauthorized/page.tsx')),
 '/auth/recovery':lazy(()=>import('main-source/app/(auth)/auth/recovery/page.tsx')),
 '/auth/confirm':lazy(()=>import('main-source/app/(auth)/auth/confirm/page.tsx')),
} as const
import {OriginalRequest,originalRoutePromise} from '../original/runtime'
function AdditionalPublic({pathname,search}:{pathname:keyof typeof additionalPublic;search:string}){
 const Page=additionalPublic[pathname]
 const searchParams=useMemo(()=>originalRoutePromise(originalSearchParams(search)),[search])
 return <OriginalRequest revision={pathname+search}><Suspense fallback={null}><Page searchParams={searchParams}/></Suspense></OriginalRequest>
}

function PendingApproval(){
 const [content,setContent]=useState<ReactNode>(null)
 const [failed,setFailed]=useState(false)
 useEffect(()=>{
  let mounted=true
  void loadPendingApproval().then(node=>{if(mounted)setContent(node)}).catch(error=>{
   if(mounted&&error?.message!=="DOCUMENT_REDIRECT")setFailed(true)
  })
  return()=>{mounted=false}
 },[])
 return failed?<p role="alert">De aanmeldservice is tijdelijk niet bereikbaar. Probeer opnieuw.</p>:content
}

export default function OriginalAuth(){
 const {pathname,search}=useLocation()
 const portal=pathname.slice("/login/".length)
 let screen:ReactNode
 if(pathname==="/login")screen=<LoginPage/>
 else if(["staff","responsible","admin","promotion","administration"].includes(portal))
  screen=<LoginForm key={portal} portal={portal as Parameters<typeof LoginForm>[0]["portal"]}/>
 else if(pathname==="/signup")screen=<SignupPage/>
 else if(pathname==="/forgot-password")screen=<ForgotPasswordForm initialError={new URLSearchParams(search).get("error")==="invalid_or_expired"?"De herstel-link is ongeldig of verlopen. Vraag hieronder een nieuwe herstel-link aan.":null}/>
 else if(pathname==="/auth/reset-password")screen=<ResetPasswordPage/>
 else if(pathname==="/verify-email")screen=<VerifyEmailClient/>
 else if(pathname==="/pending-approval")screen=<PendingApproval/>
 else if(pathname in additionalPublic)screen=<AdditionalPublic pathname={pathname as keyof typeof additionalPublic} search={search}/>
 else screen=null
 useEffect(()=>{
  document.body.classList.add("font-sans","antialiased")
  return()=>{document.body.classList.remove("font-sans","antialiased")}
 },[])
 return <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
  <style>{styles}</style><AuthLayout>{screen}</AuthLayout><LocaleSync clientRendered/>
 </ThemeProvider>
}
