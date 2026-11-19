import {useEffect,useState,type ReactNode} from "react"
import {useLocation} from "react-router-dom"
import {ThemeProvider} from "next-themes"
import LoginPage from "@/app/(auth)/login/page"
import AuthLayout from "@/app/(auth)/layout"
import SignupPage from "@/app/(auth)/signup/page"
import ResetPasswordPage from "@/app/auth/reset-password/page"
import VerifyEmailClient from "@/app/(auth)/verify-email/verify-email-client"
import loadPendingApproval from "@/app/(auth)/pending-approval/page"
import {LoginForm} from "@/components/auth/login-form"
import ForgotPasswordForm from "@/components/auth/forgot-password-form"
import {LocaleSync} from "@/components/locale-sync"
import styles from "../auth.css?inline"

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
 else screen=null
 useEffect(()=>{
  document.body.classList.add("font-sans","antialiased")
  return()=>{document.body.classList.remove("font-sans","antialiased")}
 },[])
 return <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
  <style>{styles}</style><AuthLayout>{screen}</AuthLayout><LocaleSync/>
 </ThemeProvider>
}
