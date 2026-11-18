import {defineConfig} from "vite"

export default defineConfig({
 publicDir:"public",
 build:{outDir:"dist",emptyOutDir:true,cssCodeSplit:true,rollupOptions:{output:{manualChunks(id){
  if(id.includes("node_modules/@supabase/"))return "supabase"
  if(id.includes("node_modules/react-router"))return "router"
 }}}},
 server:{port:5174,strictPort:true,proxy:{"/api":"http://127.0.0.1:8788"}},
})
