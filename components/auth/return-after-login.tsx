'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

export function ReturnAfterLogin() {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const target = window.sessionStorage.getItem('uptilldawn-return-after-login')
    if (!target) return
    window.sessionStorage.removeItem('uptilldawn-return-after-login')
    const currentPortal=pathname.startsWith('/portals/administration')?'/portals/administration':pathname.startsWith('/portals/promotion')?'/portals/promotion':null
    // Resolve and validate every saved destination, not only administration routes.
    // Reject encoded separators and control characters before client-side routing.
    if (!target.startsWith('/') || target.startsWith('//') || target.includes('\\') ||
        /[\\u0000-\\u001f\\u007f]/.test(target) || /%2f|%5c/i.test(target)) return
    let destination:URL
    try { destination=new URL(target,window.location.origin) } catch { return }
    if(destination.origin!==window.location.origin)return
    const path=destination.pathname
    if(currentPortal && path!==currentPortal && !path.startsWith(currentPortal+'/'))return
    if(pathname!==path || destination.search || destination.hash)router.replace(path+destination.search+destination.hash)
  }, [pathname, router])

  return null
}
