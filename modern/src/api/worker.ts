import {Hono} from "hono"
import {createClient} from "@supabase/supabase-js"
import {isActive,parseIdentity} from "../shared/identity"

type Bindings={SUPABASE_URL:string;SUPABASE_ANON_KEY:string}
const app=new Hono<{Bindings:Bindings}>()

// Static navigation and images bypass this Worker entirely. Only /api/*
// invokes Hono, with no Next runtime, SSR, or privileged application secrets.
app.use("/api/*",async(c,next)=>{
 await next()
 c.header("Cache-Control","private, no-store")
 c.header("X-Content-Type-Options","nosniff")
 c.header("Referrer-Policy","no-referrer")
 c.header("Content-Security-Policy","default-src 'none'; frame-ancestors 'none'")
})

app.get("/api/v1/health",c=>c.json({ok:true,service:"uptilldawn-local-first-api"}))

app.get("/api/v1/session",async c=>{
 const header=c.req.header("Authorization")||""
 const match=/^Bearer ([A-Za-z0-9._~+\/-]{30,8192})$/.exec(header)
 if(!match)return c.json({error:"authentication_required"},401)
 const url=c.env.SUPABASE_URL,key=c.env.SUPABASE_ANON_KEY
 if(!url||!key)return c.json({error:"service_unconfigured"},503)
 // ANON key only: never service-role. Each request uses its own verified token
 // for PostgREST RLS. Never cache a user-scoped Supabase client globally.
 const db=createClient(url,key,{global:{headers:{Authorization:"Bearer "+match[1]}},
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
 const {data:verified,error:claimsError}=await db.auth.getClaims(match[1])
 if(claimsError||!verified?.claims?.sub)return c.json({error:"authentication_required"},401)
 const {data:rows,error}=await db.rpc("upt_current_session_context")
 if(error)return c.json({error:"identity_unavailable"},503)
 const identity=parseIdentity(Array.isArray(rows)?rows[0]:null)
 if(!identity||identity.id!==verified.claims.sub||!isActive(identity))
  return c.json({error:"access_denied"},403)
 return c.json({id:identity.id,role:identity.role,effectiveRole:identity.effective_role,owner:identity.is_owner})
})

// Deny unknown API routes rather than returning the SPA shell with 200 OK.
app.notFound(c=>c.json({error:"not_found"},404))
app.onError((_error,c)=>c.json({error:"internal_error"},500))
export default app
