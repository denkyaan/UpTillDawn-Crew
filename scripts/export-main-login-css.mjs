// Export exactly the ordered, already compiled CSS from the authoritative Main
// static public login shells. No runtime fetching or copying of HTML/JS/secrets.
import {readFileSync,writeFileSync,mkdirSync,appendFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {resolve,dirname} from 'node:path'
import {pathToFileURL} from 'node:url'
import {execFileSync} from 'node:child_process'
const roles=['staff','responsible','admin','promotion','administration']
export function collectLoginCss(assetRoot,sha){
 if(!/^[a-f0-9]{40}$/.test(sha))throw Error('LOGIN_CSS_INVALID_SHA')
 const sheets={},routes={}
 for(const role of roles){
  const route='/login/'+role
  const html=readFileSync(resolve(assetRoot,'login',role,'index.html'),'utf8')
  const hrefs=[]
  for(const tag of html.matchAll(/<link\b[^>]*>/gi)){
   const attr=Object.fromEntries([...tag[0].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(m=>[m[1].toLowerCase(),m[2]??m[3]]))
   if(attr.rel!=='stylesheet')continue
   const href=attr.href||''
   if(!/^\/_next\/static\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.css$/.test(href)||href.includes('..')||attr.media&&attr.media!=='all')throw Error('LOGIN_CSS_UNEXPECTED_STYLESHEET')
   if(hrefs.includes(href))continue
   hrefs.push(href)
   if(!Object.hasOwn(sheets,href)){
    const css=readFileSync(resolve(assetRoot,'.'+href),'utf8')
    if(!css||/@import\b/i.test(css))throw Error('LOGIN_CSS_UNRESOLVED_IMPORT')
    // Inline CSS must not change the resolution of relative asset URLs.
    for(const match of css.matchAll(/url\(\s*["']?([^"'\s)]+)["']?\s*\)/gi)){
     if(!/^(?:data:|\/[^/]|#)/i.test(match[1]))throw Error('LOGIN_CSS_RELATIVE_OR_EXTERNAL_URL')
     if(match[1].startsWith('/_next/'))throw Error('LOGIN_CSS_REQUIRES_NEXT_ASSET')
    }
    sheets[href]=css
   }
  }
  if(!hrefs.length)throw Error('LOGIN_CSS_MISSING '+route)
  routes[route]=hrefs
 }
 if(!Object.values(sheets).some(css=>css.includes('.auth-portal-screen')))throw Error('LOGIN_CSS_WRONG_SOURCE')
 return {sha,sheets,routes}
}
export function loginCssManifest(payload){
 const sheets=Object.fromEntries(Object.entries(payload.sheets).map(([href,css])=>[href,{
  sha256:createHash('sha256').update(css,'utf8').digest('hex'),bytes:Buffer.byteLength(css,'utf8')
 }]))
 return {sha:payload.sha,routes:payload.routes,sheets}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const sha=process.env.VALIDATED_SHA||''
 if(sha!==execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim())throw Error('LOGIN_CSS_WRONG_CHECKOUT')
 const target=resolve('main-login-css-artifact','main-login-css.json')
 mkdirSync(dirname(target),{recursive:true})
 const payload=collectLoginCss('.open-next/assets',sha)
 writeFileSync(target,JSON.stringify(payload))
 if(process.env.GITHUB_OUTPUT){
  const manifest=JSON.stringify(loginCssManifest(payload))
  if(Buffer.byteLength(manifest,'utf8')>32768)throw Error('LOGIN_CSS_MANIFEST_TOO_LARGE')
  appendFileSync(process.env.GITHUB_OUTPUT,'manifest='+manifest+'\n')
 }
 console.log('Exported original compiled Main login CSS for '+sha)
}
