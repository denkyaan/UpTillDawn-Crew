// Reproduce the exact failed deployed build with the public byte-verified
// stylesheet from Deploy #587. This is a one-branch preflight, never a release
// input; the actual Main deployment still derives CSS from its own build.
import {mkdirSync,writeFileSync} from 'node:fs'
import {retrieveLoginCss} from '../../scripts/retrieve-main-login-css.mjs'
const sha='9052fde2dd460fe17dc24c9d1cf8103ef3cc49dc'
const href='/_next/static/chunks/21--9efqltgh9.css'
const routes=Object.fromEntries(['staff','responsible','admin','promotion','administration'].map(role=>['/login/'+role,[href]]))
const payload=await retrieveLoginCss({sha,routes,sheets:{[href]:{sha256:'627c3b830fef3b08692e500b2916be8193441269aa52549aa301e3049a0e84f5',bytes:83040}}},sha)
mkdirSync('main-login-css-artifact',{recursive:true})
writeFileSync('main-login-css-artifact/main-login-css.json',JSON.stringify(payload))
console.log('Verified exact 83040-byte CSS from failed Deploy #587 for budget preflight')
