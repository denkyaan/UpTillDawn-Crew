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
    if(currentPortal){
      try{const destination=new URL(target,window.location.origin);if(destination.origin!==window.location.origin)return;const path=destination.pathname;if(path!==currentPortal&&!path.startsWith(currentPortal+'/'))return}catch{return}
    }
    if (target.startsWith('/') && !target.startsWith('//') && !target.includes('\\') && target !== pathname) {
      router.replace(target)
    }
  }, [pathname, router])

  return null
}
