import {defineConfig} from "vite"
import {readFileSync} from "node:fs"
import {fileURLToPath} from "node:url"
import tailwind from "@tailwindcss/vite"
import {mainSourcePlugin} from "./tooling/main-source.mjs"

const root=fileURLToPath(new URL("..",import.meta.url))
const local=(path:string)=>fileURLToPath(new URL(path,import.meta.url))
const authTarget="https://uptilldawn-main.uptilldawn.workers.dev"

// Main deployment provides the already compiled CSS from the same validated
// Next build. Inject it as JavaScript data so Vite cannot re-optimize colors.
// Standalone local builds still use their normal source stylesheet.
const expectedLoginCssSha=process.env.UPT_EXACT_MAIN_LOGIN_CSS_SHA
let exactLoginCss=null
if(expectedLoginCssSha){
 const payload=JSON.parse(readFileSync(local("../main-login-css-artifact/main-login-css.json"),"utf8"))
 if(payload.sha!==expectedLoginCssSha||!payload.sheets||!payload.routes)throw Error("EXACT_MAIN_LOGIN_CSS_SHA_MISMATCH")
 for(const role of ["staff","responsible","admin","promotion","administration"]){
  const hrefs=payload.routes["/login/"+role]
  if(!Array.isArray(hrefs)||!hrefs.length||hrefs.some((href:unknown)=>typeof href!=="string"||typeof payload.sheets[href]!=="string"||!payload.sheets[href]))throw Error("EXACT_MAIN_LOGIN_CSS_INCOMPLETE")
 }
 exactLoginCss={sheets:payload.sheets,routes:payload.routes}
}
export default defineConfig({
 define:{__UPT_EXACT_MAIN_LOGIN_CSS__:JSON.stringify(exactLoginCss)},
 plugins:[mainSourcePlugin(),tailwind()],
 resolve:{
  dedupe:["react","react-dom"],
  alias:[
   {find:"next/link",replacement:local("src/compat/link.tsx")},
   {find:"next/image",replacement:local("src/compat/image.tsx")},
   {find:"next/navigation",replacement:local("src/compat/navigation.ts")},
   {find:"@/lib/actions/auth",replacement:local("src/compat/auth-actions.ts")},
   {find:"@/lib/server-locale",replacement:local("src/compat/server-locale.ts")},
   {find:"@/lib/supabase/crew-server",replacement:local("src/compat/crew-browser.ts")},
   {find:"@",replacement:root},
   {find:/^tailwindcss$/,replacement:local("node_modules/tailwindcss/index.css")},
   {find:/^tw-animate-css$/,replacement:local("node_modules/tw-animate-css/dist/tw-animate.css")},
   // Root source files resolve the candidate's isolated packages, also when
   // the legacy Next node_modules directory is absent in the deploy runner.
   ...["zod","prettier","@uiw/react-codemirror","@codemirror","sonner","lucide-react","next-themes","class-variance-authority","clsx","tailwind-merge","@radix-ui/react-label","@radix-ui/react-slot"].map(name=>({find:name,replacement:local("node_modules/"+name)})),
  ],
 },
 publicDir:"public",
 build:{outDir:"dist",emptyOutDir:true,cssCodeSplit:true,manifest:true,rollupOptions:{output:{manualChunks(id){
  if(id.includes("node_modules/@supabase/"))return "supabase"
  if(id.includes("node_modules/react-router"))return "router"
 }}}},
 server:{port:5174,strictPort:true,fs:{allow:[root]},proxy:{
  "/api/auth":{target:authTarget,changeOrigin:true,configure(proxy){proxy.on("proxyReq",req=>{req.setHeader("Origin",authTarget);req.setHeader("Sec-Fetch-Site","same-origin")})}},
  "/auth/callback":{target:authTarget,changeOrigin:true,autoRewrite:true},
  "/portals/switch":{target:authTarget,changeOrigin:true,autoRewrite:true},
  "/api":{target:authTarget,changeOrigin:true,configure(proxy){proxy.on("proxyReq",req=>{req.setHeader("Origin",authTarget);req.setHeader("Sec-Fetch-Site","same-origin")})}},
 }},
})
